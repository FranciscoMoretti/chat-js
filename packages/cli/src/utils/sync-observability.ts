// oxlint-disable-next-line import/no-nodejs-modules -- The Node/Bun CLI reads, writes, and validates real project files with native filesystem APIs.
import { access, readFile, rm, writeFile } from "node:fs/promises";
// oxlint-disable-next-line import/no-nodejs-modules -- The Node/Bun CLI resolves platform-specific project and installation paths.
import path from "node:path";

/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { featureDefinitionSchema } from "../../../registry/metadata";
/* oxlint-enable sort-imports */
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { observabilityItems } from "../../../registry/src/features/observability";
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve exists's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable import/no-relative-parent-imports */

const exists = async (file: string): Promise<boolean> => {
  try {
    await access(file);
    return true;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
};
/* oxlint-enable oxc/no-async-await */
type ObservabilityId = ReturnType<typeof featureDefinitionSchema.parse>["id"];

const NO_INSTALLED_FILES = 0;
const JSON_INDENTATION_SPACES = 2;

interface ObservabilityFile {
  readonly path: string;
  readonly target?: string;
}

interface ObservabilitySource {
  readonly name: string;
  readonly files?: readonly ObservabilityFile[];
}

interface LocatedFile {
  readonly present: boolean;
  readonly target: string;
}

interface ObservabilityManifest {
  dependencies?: Record<string, unknown> | null;
}

const isJsonObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isObservabilityManifest = (
  value: unknown
): value is ObservabilityManifest =>
  isJsonObject(value) &&
  (!Object.hasOwn(value, "dependencies") ||
    value.dependencies === null ||
    isJsonObject(value.dependencies));

const formattedManifest = (value: unknown): string =>
  // oxlint-disable-next-line unicorn/no-null -- JSON.stringify's null replacer retains unknown template metadata; its third argument preserves deterministic two-space formatting.
  `${JSON.stringify(value, null, JSON_INDENTATION_SPACES)}\n`;

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve locateObservabilityFile's awaited sequencing and rejected-Promise behavior. */
const locateObservabilityFile = async (
  cwd: string,
  file: ObservabilityFile
): Promise<LocatedFile> => {
  const target = file.target?.replace(/^~\//u, "");
  if (typeof target !== "string" || target === "") {
    throw new Error(
      `Observability file needs an explicit target: ${file.path}`
    );
  }
  return { present: await exists(path.join(cwd, target)), target };
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve completeObservabilitySource's awaited sequencing and rejected-Promise behavior. */
const completeObservabilitySource = async (
  item: ObservabilitySource,
  descriptor: string,
  files: readonly LocatedFile[]
): Promise<ObservabilityId[]> => {
  const definition = featureDefinitionSchema.parse(
    JSON.parse(await readFile(descriptor, "utf-8"))
  );
  if (definition.id !== item.name) {
    throw new Error(
      `Feature descriptor id must match its directory: ${item.name}`
    );
  }
  const missing = files.filter((file: LocatedFile): boolean => !file.present);
  if (missing.length > NO_INSTALLED_FILES) {
    throw new Error(
      `${item.name} installation is incomplete. Missing: ${missing.map((file: LocatedFile): string => file.target).join(", ")}. Run chat-js add ${item.name}.`
    );
  }
  return [item.name];
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve installedObservabilityIds's awaited sequencing and rejected-Promise behavior. */
// Finish validating each implementation before its ID contributes to output.
const installedObservabilityIds = async (
  cwd: string,
  item: ObservabilitySource
): Promise<ObservabilityId[]> => {
  const descriptor = path.join(cwd, `features/${item.name}/chatjs.json`);
  const present = await exists(descriptor);
  const files = await Promise.all(
    (item.files ?? []).map(
      async (file: ObservabilityFile): Promise<LocatedFile> =>
        await locateObservabilityFile(cwd, file)
    )
  );
  if (!present) {
    if (files.some((file: LocatedFile): boolean => file.present)) {
      throw new Error(
        `${item.name} is missing its descriptor. Run chat-js add ${item.name} to complete installation.`
      );
    }
    return [];
  }
  return await completeObservabilitySource(item, descriptor, files);
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve planObservability's awaited sequencing and rejected-Promise behavior. */
// Validate every installed implementation before sync writes any registrations.
const planObservability = async (
  cwd: string
): Promise<{
  files: { content: string; file: string }[];
  ids: ObservabilityId[];
}> => {
  const installed = await Promise.all(
    observabilityItems.map(
      async (item: ObservabilitySource): Promise<ObservabilityId[]> =>
        await installedObservabilityIds(cwd, item)
    )
  );
  const ids = installed.flat();
  const layout = ids.filter((id) => id !== "langfuse");
  const imports = layout
    .map(
      (id, index): string =>
        `import { Component as Component${index} } from "@/features/${id}/component";`
    )
    .join("\n");
  const instrumentationImport = ids.includes("langfuse")
    ? 'import { register } from "@/features/langfuse/instrumentation";\n'
    : "";
  return {
    files: [
      {
        content: `// Generated by chat-js sync.\n${imports ? `${imports}\n` : ""}import type { InstalledLayoutComponent } from "@/lib/installation-contracts";\n\nexport const installedLayoutComponents: readonly {\n  id: string;\n  Component: InstalledLayoutComponent;\n}[] = ${layout.length > NO_INSTALLED_FILES ? `[\n${layout.map((id, index): string => `  { Component: Component${index}, id: "${id}" },`).join("\n")}\n]` : "[]"};\n`,
        file: path.join(cwd, "features/installed-layout.ts"),
      },
      {
        content: `// Generated by chat-js sync.\n${instrumentationImport}${ids.includes("langfuse") ? "// oxlint-disable-next-line sort-imports -- Oxfmt places the runtime feature import before the erased registration type; preserve the formatter-owned generated import grouping.\n" : ""}import type { InstrumentationRegistration } from "@/lib/installation-contracts";\n\nexport const installedInstrumentation: readonly InstrumentationRegistration[] =\n  [${ids.includes("langfuse") ? "register" : ""}];\n`,
        file: path.join(cwd, "features/installed-instrumentation.ts"),
      },
    ],
    ids,
  };
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve initializeObservability's awaited sequencing and rejected-Promise behavior. */
// Creation only: reset demo selections. Sync/add never remove implementations.
const initializeObservability = async (cwd: string): Promise<void> => {
  await Promise.all(
    observabilityItems.map(
      async (item: Readonly<{ name: string }>): Promise<void> => {
        await rm(path.join(cwd, "features", item.name), {
          force: true,
          recursive: true,
        });
      }
    )
  );
  const manifestPath = path.join(cwd, "package.json");
  if (!(await exists(manifestPath))) {
    return;
  }
  const manifest: unknown = JSON.parse(await readFile(manifestPath, "utf-8"));
  if (!isObservabilityManifest(manifest)) {
    throw new TypeError(
      "Observability initialization needs a package JSON object with an optional dependency object."
    );
  }
  for (const dependency of [
    "@vercel/analytics",
    "@vercel/speed-insights",
    "@vercel/otel",
    "langfuse-vercel",
    "langfuse",
  ]) {
    delete manifest.dependencies?.[dependency];
  }
  await writeFile(manifestPath, formattedManifest(manifest));
};
/* oxlint-enable oxc/no-async-await */
export { initializeObservability, planObservability };
