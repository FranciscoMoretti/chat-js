/* oxlint-disable import/max-dependencies -- Oxlint counts 19 dependencies here against its maximum of 10; this installer composes the cross-package runtime adapters and readonly descriptor contract. */
/* oxlint-disable import/no-nodejs-modules -- This code runs on the Node/Bun server or installer and requires the built-in operating-system API. */
import { createHash } from "node:crypto";
/* oxlint-enable import/no-nodejs-modules */
/* oxlint-disable import/no-nodejs-modules -- This code runs on the Node/Bun server or installer and requires the built-in operating-system API. */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import fs, {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
/* oxlint-enable sort-imports */
/* oxlint-enable import/no-nodejs-modules */
/* oxlint-disable import/no-nodejs-modules -- This code runs on the Node/Bun server or installer and requires the built-in operating-system API. */
import { tmpdir } from "node:os";
/* oxlint-enable import/no-nodejs-modules */
/* oxlint-disable import/no-nodejs-modules -- This code runs on the Node/Bun server or installer and requires the built-in operating-system API. */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import path from "node:path";
/* oxlint-enable sort-imports */
/* oxlint-enable import/no-nodejs-modules */

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { format } from "oxfmt";
import ultracite from "ultracite/oxfmt";
/* oxlint-enable sort-imports */
import { z } from "zod";

/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { configureGatewayProvider } from "../../cli/src/helpers/gateway-provider";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- The pinned rule sorts these declarations by binding, but the source path order requires ReadonlyInput after configureGatewayProvider. */
import type { ReadonlyInput } from "../../cli/src/helpers/readonly-input";
/* oxlint-enable sort-imports */
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { configureStorageProvider } from "../../cli/src/helpers/storage-provider";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { resolveGateway } from "../../cli/src/registry/gateways";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { installItems } from "../../cli/src/registry/shadcn";
/* oxlint-enable sort-imports */
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { resolveStorage } from "../../cli/src/registry/storage";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { planInstallation } from "../../cli/src/utils/installation-plan";
/* oxlint-enable sort-imports */
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { preflight } from "../../cli/src/utils/preflight";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { syncFeatures } from "../../cli/src/utils/sync-features";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { syncTools } from "../../cli/src/utils/sync-tools";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { demoInstallation } from "../installation";
/* oxlint-enable sort-imports */
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { registry } from "../registry";
/* oxlint-enable import/no-relative-parent-imports */

// Explicit demo exceptions, scoped to one value/import. Everything else is checked.
const demoSource = (file: string, source: string): string => {
  if (file === "lib/ai/gateway-model-defaults.ts") {
    // Keep the demo's existing chat model rather than the fresh scaffold default.
    return source.replace(
      'chat: "openai/gpt-5-mini"',
      'chat: "google/gemini-2.5-flash-lite"'
    );
  }
  return source;
};

const registryRoot = path.resolve(import.meta.dir, "..");

/* oxlint-enable import/max-dependencies */
const demoRoot = path.resolve(registryRoot, "../../apps/chat");

const baselinePath = path.join(registryRoot, "demo-baseline.json");

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve formatted's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
const formatted = async (file: string, content: string): Promise<string> => {
  if (
    content.startsWith("// Generated by chat-js sync.") &&
    content.includes("\n// Content:")
  ) {
    return content;
  }
  const result = await format(file, content, ultracite);
  if (result.errors.length > 0) {
    throw new Error(`Could not format demo source: ${file}`);
  }
  return result.code;
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable eslint/no-magic-numbers */
const digest = (content: string): string =>
  createHash("sha256").update(content).digest("hex");
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve optionalRead's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable unicorn/no-null -- Null is an explicit SDK, serialized-data, or React absence sentinel; replacing it would change the contract. */
const optionalRead = async (file: string): Promise<string | null> => {
  try {
    return await readFile(file, "utf-8");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve filesBelow's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable unicorn/no-null */

const filesBelow = async (
  directory: string,
  prefix = ""
): Promise<string[]> => {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry: Readonly<(typeof entries)[number]>) => {
      const file = path.posix.join(prefix, entry.name);

      if (entry.isDirectory()) {
        return await filesBelow(path.join(directory, entry.name), file);
      }
      return [file];
    })
  );
  return nested.flat();
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve generateDemo's awaited sequencing and rejected-Promise behavior. */

/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable jsdoc/require-returns -- The comment documents lifecycle behavior; the TypeScript return contract remains the authoritative result description. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the ordered validation, state transitions, and cleanup in one operation so their sequencing remains reviewable. */
/* oxlint-disable eslint/init-declarations -- The value is assigned by the following guarded operation; an invented initial value would hide an uninitialized control-flow branch. */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
/** Install canonical sources through the CLI's planner and shadcn transforms. */
const generateDemo = async (): Promise<Map<string, string>> => {
  const temporary = await mkdtemp(path.join(tmpdir(), "chatjs-demo-"));
  let stopServer: (() => void) | undefined;
  try {
    // This source-only registry retains registry dependencies, but omits package
    // installation: the demo already owns its workspace dependency manifest.
    const items = await Promise.all(
      // oxlint-disable-next-line oxc/no-map-spread -- #541: Build installation records with file contents without mutating the reusable registry manifest.
      registry.items.map(
        async (item: ReadonlyInput<(typeof registry.items)[number]>) => {
          const files = await Promise.all(
            // oxlint-disable-next-line oxc/no-map-spread -- #541: Build installation records with file contents without mutating the reusable registry manifest.
            (item.files ?? []).map(
              async (
                file: ReadonlyInput<
                  NonNullable<(typeof registry.items)[number]["files"]>[number]
                >
              ) => ({
                // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing file own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
                ...file,
                content: await readFile(
                  path.join(registryRoot, file.path),
                  "utf-8"
                ),
              })
            )
          );
          const itemMeta: unknown = item.meta;
          const metadata: unknown =
            typeof itemMeta === "object" &&
            itemMeta &&
            "chatjs" in itemMeta &&
            itemMeta.chatjs;
          if (
            typeof metadata === "object" &&
            metadata &&
            "kind" in metadata &&
            (metadata.kind === "tool" || metadata.kind === "feature")
          ) {
            const target =
              // oxlint-disable-next-line no-ternary -- Keep target as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
              metadata.kind === "tool"
                ? `~/tools/chatjs/${item.name}/chatjs.json`
                : `~/features/${item.name}/chatjs.json`;
            files.push({
              content: await formatted(target, JSON.stringify(metadata)),
              path: `${item.name}.json`,
              target,
              type: "registry:file",
            });
          }
          // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing item own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
          return { ...item, dependencies: [], devDependencies: [], files };
        }
      )
    );
    const server = Bun.serve({
      fetch(request: Readonly<Pick<Request, "url">>) {
        const name = new URL(request.url).pathname
          .slice(1)
          .replace(/\.json$/u, "");
        const item = items.find(
          (candidate: ReadonlyInput<(typeof items)[number]>) =>
            candidate.name === name
        );

        if (item) {
          return Response.json(item);
        }
        return new Response("Not found", { status: 404 });
      },
      hostname: "127.0.0.1",
      port: 0,
    });

    stopServer = (): void => {
      void server.stop(true);
    };
    const parsedComponents: unknown = JSON.parse(
      await readFile(path.join(demoRoot, "components.json"), "utf-8")
    );
    if (
      typeof parsedComponents !== "object" ||
      parsedComponents === null ||
      Array.isArray(parsedComponents)
    ) {
      throw new Error("Demo components.json must contain an object");
    }
    const components = Object.assign(parsedComponents, {
      registries: {
        "@chatjs": `http://127.0.0.1:${server.port}/{name}.json`,
      },
    });
    await mkdir(path.join(temporary, "app"), { recursive: true });
    await Promise.all([
      writeFile(
        path.join(temporary, "components.json"),
        JSON.stringify(components)
      ),
      writeFile(
        path.join(temporary, "package.json"),
        '{"name":"demo-sync","dependencies":{}}'
      ),
      writeFile(
        path.join(temporary, "tsconfig.json"),
        '{"compilerOptions":{"baseUrl":".","paths":{"@/*":["./*"]}}}'
      ),
      writeFile(
        path.join(temporary, "app/globals.css"),
        '@import "tailwindcss";'
      ),
    ]);
    const { gateway, storage } = demoInstallation;
    if (!(typeof gateway === "string" && gateway !== "") || !storage) {
      throw new Error("Demo preset requires gateway and storage selections");
    }
    const plan = await planInstallation(temporary, demoInstallation, {
      fresh: true,
    });
    await installItems(plan.sources, temporary, true);
    await configureGatewayProvider(
      temporary,
      await resolveGateway(gateway, temporary)
    );
    await configureStorageProvider(temporary, {
      // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing (await resolveStorage(storage.source, temporary)) own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
      ...(await resolveStorage(storage.source, temporary)),
      options: storage.options,
    });
    await syncTools(temporary, { expected: plan.expected });
    // Composer/settings ordering is application-owned; never initialize or add UI here.
    await syncFeatures(temporary, {
      expectedMcp: plan.features.some(
        (feature: ReadonlyInput<(typeof plan.features)[number]>) =>
          feature.id === "mcp"
      ),
      expectedUploads: plan.features.some(
        (feature: ReadonlyInput<(typeof plan.features)[number]>) =>
          feature.id === "attachment-uploads"
      ),
    });
    // Narrow application-owned exceptions: model catalog is fetched separately;
    // credentials, dependency manifests, UI order and extension files stay local.
    const excluded = new Set([
      "components.json",
      "composer-controls.ts",
      "settings-items.ts",
      "package.json",
      "tsconfig.json",
      "app/globals.css",
      ".env.example",
      "lib/ai/models.generated.ts",
      "tools/chatjs/custom-tools.ts",
      "tools/chatjs/custom-ui.ts",
    ]);
    const installedFiles = await filesBelow(temporary);
    const copies = await Promise.all(
      installedFiles
        .filter((file) => !excluded.has(file))
        .toSorted()
        .map(async (file) => {
          const content = await readFile(path.join(temporary, file), "utf-8");
          const normalized = await formatted(file, content);
          return [
            file,
            await formatted(file, demoSource(file, normalized)),
          ] as const;
        })
    );
    const output = new Map(copies);
    return output;
  } finally {
    if (stopServer) {
      stopServer();
    }
    await fs.rm(temporary, { force: true, recursive: true });
  }
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable eslint/init-declarations */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable jsdoc/require-returns */
/* oxlint-enable eslint/max-statements */

const DEMO_BASELINE_VERSION = 1;

const baselineSchema = z.strictObject({
  files: z.record(z.string(), z.string().regex(/^[a-f0-9]{64}$/u)),
  version: z.literal(DEMO_BASELINE_VERSION),
});

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve replaceDemoFiles's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the ordered validation, state transitions, and cleanup in one operation so their sequencing remains reviewable. */
/* oxlint-disable jsdoc/require-param -- This comment documents the API invariant; parameter names and TypeScript annotations describe the inputs without duplicating them in tags. */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
/** Stage every write before replacing files; retain originals until the baseline commits. */
const replaceDemoFiles = async (
  updates: readonly {
    readonly target: string;
    readonly content: string;
    readonly exists: boolean;
  }[]
): Promise<void> => {
  const staged: {
    target: string;
    directory: string;
    exists: boolean;
    backedUp: boolean;
    installed: boolean;
  }[] = [];
  let retainBackups = false;
  try {
    for (const update of updates) {
      // oxlint-disable-next-line eslint/no-await-in-loop -- Stage all outputs before replacing any destination.
      await mkdir(path.dirname(update.target), { recursive: true });
      // oxlint-disable-next-line eslint/no-await-in-loop -- Temporary files must share the destination filesystem.
      const directory = await mkdtemp(
        path.join(path.dirname(update.target), ".demo-sync-")
      );
      // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing update own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
      staged.push({ ...update, backedUp: false, directory, installed: false });
      // oxlint-disable-next-line eslint/no-await-in-loop -- Complete each staged file before advancing to the next replacement.
      await writeFile(path.join(directory, "next"), update.content);
    }
    for (const update of staged) {
      if (update.exists) {
        // oxlint-disable-next-line eslint/no-await-in-loop -- Keep originals for rollback until all replacements succeed.
        await fs.rename(update.target, path.join(update.directory, "previous"));
        update.backedUp = true;
      }
      // oxlint-disable-next-line eslint/no-await-in-loop -- Commit in order, with the baseline last.
      await fs.rename(path.join(update.directory, "next"), update.target);
      update.installed = true;
    }
  } catch (error) {
    const failures: unknown[] = [];
    for (const update of staged.toReversed()) {
      try {
        if (update.installed) {
          // oxlint-disable-next-line eslint/no-await-in-loop -- Restore replacements in reverse commit order.
          await rm(update.target);
        }
        if (update.backedUp) {
          // oxlint-disable-next-line eslint/no-await-in-loop -- Restore each original sequentially before rolling back the preceding committed file.
          await fs.rename(
            path.join(update.directory, "previous"),
            update.target
          );
        }
      } catch (rollbackError) {
        failures.push(rollbackError);
      }
    }
    if (failures.length > 0) {
      retainBackups = true;
      throw new AggregateError(
        [error, ...failures],
        `Demo sync rollback failed; recovery files retained in:\n${staged.map((update: Readonly<(typeof staged)[number]>) => update.directory).join("\n")}`,
        { cause: error }
      );
    }
    throw error;
  } finally {
    if (!retainBackups) {
      await Promise.all(
        // oxlint-disable-next-line typescript/promise-function-async -- Pass the Node rm promise directly to Promise.all without an extra async wrapper.
        staged.map((update: Readonly<(typeof staged)[number]>) =>
          rm(update.directory, { force: true, recursive: true })
        )
      );
    }
  }
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve syncDemo's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable jsdoc/require-param */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable eslint/max-statements */

/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the ordered validation, state transitions, and cleanup in one operation so their sequencing remains reviewable. */
/* oxlint-disable jsdoc/require-param -- This comment documents the API invariant; parameter names and TypeScript annotations describe the inputs without duplicating them in tags. */
/* oxlint-disable unicorn/no-null -- Null is an explicit SDK, serialized-data, or React absence sentinel; replacing it would change the contract. */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
/** Check all files before writing any: a failed protection check never partially syncs. */
const syncDemo = async (options: {
  readonly root: string;
  readonly baseline: string;
  readonly expected: Pick<ReadonlyMap<string, string>, "get" | "has" | "keys">;
  readonly check?: boolean;
  readonly discard?: boolean;
}): Promise<void> => {
  const { root, baseline, expected, check = false, discard = false } = options;
  await preflight(path.dirname(baseline), [path.basename(baseline)]);
  const previous = await optionalRead(baseline);
  const record =
    // oxlint-disable-next-line no-ternary -- Keep record as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
    typeof previous === "string" && previous !== ""
      ? baselineSchema.parse(JSON.parse(previous))
      : null;
  const fileSet = new Set(expected.keys());
  if (record !== null) {
    for (const file of Object.keys(record.files ?? {})) {
      fileSet.add(file);
    }
  }
  const files = [...fileSet].toSorted();
  await preflight(root, files);
  const current = new Map(
    await Promise.all(
      files.map(
        async (file) =>
          [file, await optionalRead(path.join(root, file))] as const
      )
    )
  );
  const edited = files.filter((file) => {
    const content = current.get(file) ?? null;
    // Edits moved upstream already match canonical output and can be adopted.
    if (content !== null && content === expected.get(file)) {
      return false;
    }
    // oxlint-disable-next-line no-ternary -- Keep hash as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
    const hash = content === null ? null : digest(content);

    if (record !== null && record.files[file]) {
      return hash !== record.files[file];
    }
    return content !== null && content !== expected.get(file);
  });
  if (edited.length > 0 && !discard) {
    throw new Error(
      `Edited registry-owned demo files:\n${edited.join("\n")}\nMove changes upstream or explicitly regenerate with bun demo:sync --discard.`
    );
  }
  const staleOwnership = files.filter((file) => !expected.has(file));
  if (staleOwnership.length > 0) {
    throw new Error(
      `Preset removed owned files; removal is outside demo sync scope:\n${staleOwnership.join("\n")}`
    );
  }
  const drift = files.filter(
    (file) => current.get(file) !== expected.get(file)
  );
  const next = {
    files: Object.fromEntries(
      files.map((file) => [file, digest(expected.get(file) ?? "")])
    ),
    version: DEMO_BASELINE_VERSION,
  };
  const baselineContent = await formatted(
    "demo-baseline.json",
    JSON.stringify(next)
  );
  const baselineDrift = previous !== baselineContent;
  if (check) {
    if (drift.length > 0 || baselineDrift) {
      throw new Error(
        // oxlint-disable-next-line no-ternary -- Keep template interpolation as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
        `Demo source drift:\n${drift.join("\n")}${baselineDrift ? `\nBaseline drift: ${baseline}` : ""}\nRun bun demo:sync to update source and its baseline.`
      );
    }
    return;
  }
  await replaceDemoFiles([
    ...drift.map((file) => ({
      content: expected.get(file) ?? "",
      exists: current.get(file) !== null,
      target: path.join(root, file),
    })),
    { content: baselineContent, exists: previous !== null, target: baseline },
  ]);
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable unicorn/no-null */
/* oxlint-enable jsdoc/require-param */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable eslint/max-statements */

/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
if (import.meta.main) {
  const args = process.argv.slice(2);
  if (
    args.some((arg) => arg !== "--check" && arg !== "--discard") ||
    (args.includes("--check") && args.includes("--discard"))
  ) {
    throw new Error("Usage: bun demo:sync [--discard] | bun demo:check");
  }
  // oxlint-disable-next-line node/no-top-level-await -- This Bun entrypoint completes demo synchronization before reporting command completion.
  await syncDemo({
    baseline: baselinePath,
    check: args.includes("--check"),
    discard: args.includes("--discard"),
    // oxlint-disable-next-line node/no-top-level-await -- This Bun entrypoint generates the canonical demo before synchronizing or checking its installed files.
    expected: await generateDemo(),
    root: demoRoot,
  });
}

/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (baselinePath, demoRoot, demoSource, generateDemo, syncDemo); the enabled import/no-default-export convention rejects the default-export alternative. */
/* oxlint-disable max-lines -- Keep this cohesive contract and its cases together; splitting it solely for a line quota would obscure shared setup or state transitions. */
/* oxlint-enable eslint/no-magic-numbers */
export { baselinePath, demoRoot, demoSource, generateDemo, syncDemo };
/* oxlint-enable import/no-named-export */
