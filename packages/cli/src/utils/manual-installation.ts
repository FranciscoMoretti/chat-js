import { installationActivation } from "./installation-activation";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { readItem } from "#cli/registry/shadcn";

type RegistryItem = Awaited<ReturnType<typeof readItem>>;

// Resolve source without consulting installed registrations: this is also the
// escape hatch for legacy layouts, duplicate providers and edited indexes.
const resolveManualItems = async (cwd: string, sources: readonly string[]) => {
  const items = new Map<string, RegistryItem>();
  const visited = new Set<string>();
  const visit = async (source: string): Promise<void> => {
    if (visited.has(source)) {
      return;
    }
    visited.add(source);
    const item = await readItem(source, cwd);
    items.set(source, item);
    await Promise.all((item.registryDependencies ?? []).map(visit));
  };
  await Promise.all(sources.map(visit));
  return [...items].toSorted(([left], [right]) => left.localeCompare(right));
};

/** Export unmodified registry source for manual integration, never activation. */
export const exportManualInstallation = async (
  cwd: string,
  sources: readonly string[]
): Promise<string> => {
  if (sources.length === 0) {
    throw new Error("Select at least one registry item to export.");
  }
  const items = await resolveManualItems(cwd, sources);
  const output = await mkdtemp(path.join(tmpdir(), "chatjs-manual-"));
  try {
    const results = await Promise.allSettled(
      items.map(async ([source, item], itemIndex) => {
        const directory = `items/${itemIndex}`;
        await mkdir(path.join(output, directory), { recursive: true });
        await writeFile(
          path.join(output, directory, "registry-item.json"),
          `${JSON.stringify(item, null, 2)}\n`
        );
        const fileResults = await Promise.allSettled(
          (item.files ?? []).map(async (file, fileIndex) => {
            if (typeof file.content !== "string") {
              throw new TypeError(
                `Registry file has no source: ${source}: ${file.path}`
              );
            }
            // Never use registry-controlled paths as export destinations. Two
            // conflicting items must both remain available for manual review.
            const filename = path.posix.basename(
              file.path.replaceAll("\\", "/")
            );
            const exported = `${directory}/${fileIndex}-${filename}`;
            await writeFile(path.join(output, exported), file.content);
            return {
              exported,
              path: file.path,
              target: file.target ?? null,
              type: file.type,
            };
          })
        );
        const files = fileResults.map((result) => {
          if (result.status === "rejected") {
            throw result.reason;
          }
          return result.value;
        });
        const integration: unknown = item.meta?.chatjs ?? null;
        return {
          source,
          name: item.name,
          files,
          dependencies: item.dependencies ?? [],
          devDependencies: item.devDependencies ?? [],
          registryDependencies: item.registryDependencies ?? [],
          integration,
          activation: installationActivation(
            integration,
            files.flatMap((file) =>
              file.target?.startsWith("~/") === true
                ? [file.target.slice(2)]
                : []
            )
          ),
          registryItem: `${directory}/registry-item.json`,
        };
      })
    );
    const manifest = results.map((result) => {
      if (result.status === "rejected") {
        throw result.reason;
      }
      return result.value;
    });
    await writeFile(
      path.join(output, "manifest.json"),
      `${JSON.stringify({ mode: "manual", items: manifest }, null, 2)}\n`
    );
    await writeFile(
      path.join(output, "README.md"),
      [
        "# Manual ChatJS integration",
        "",
        "This bundle contains registry source, not an activated installation. Your application, dependencies, receipts and generated lists were not changed.",
        "",
        "1. Inspect manifest.json for each source file, intended target, package dependency and ChatJS integration descriptor. Each registry-item.json preserves the full upstream item, including CSS, environment and other installation metadata.",
        "2. Select the source you need and copy it into app-owned locations. Explicit ~/ targets are relative to the app root; null targets require shadcn destination resolution. This is raw registry source: adapt aliases, styling/library transforms and package dependencies to your app. Existing components/ui primitives can be reused.",
        "3. Connect the exported behavior/components from app-owned integration files. Keep client and server imports separate. Resolve exclusive providers, duplicate names, ordering and prerequisites explicitly.",
        "4. Review app/ routes, agent/ hooks and database schema separately before copying them: placement can activate framework behavior. Review migrations before applying them.",
        "5. Keep chatjs.json descriptors out of auto-discovered plugins/ and tools/chatjs/ directories unless you intend to enroll the item in chat-js sync. Do not copy this bundle wholesale into the app or edit chatjs/generated to make a manual connection.",
        "6. Typecheck and exercise the integration in your app. Manual copies are app-owned; chat-js status/remove do not track this bundle or connections you create from it.",
        "",
        "To retry managed installation after resolving a conflict, run chat-js add with the original selection without --files-only. Review source collisions first; --yes does not authorize overwriting edits.",
        "",
      ].join("\n")
    );
    return output;
  } catch (error) {
    await rm(output, { recursive: true, force: true });
    throw error;
  }
};
