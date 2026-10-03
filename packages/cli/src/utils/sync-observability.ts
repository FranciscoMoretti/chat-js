/* oxlint-disable import/no-nodejs-modules -- This code runs on the Node/Bun server or installer and requires the built-in operating-system API. */
import { access, readFile, rm, writeFile } from "node:fs/promises";
/* oxlint-enable import/no-nodejs-modules */
/* oxlint-disable import/no-nodejs-modules -- This code runs on the Node/Bun server or installer and requires the built-in operating-system API. */
import path from "node:path";
/* oxlint-enable import/no-nodejs-modules */

/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { featureDefinitionSchema } from "../../../registry/metadata";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-enable eslint/sort-imports */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { observabilityItems } from "../../../registry/src/features/observability";
/* oxlint-enable import/no-relative-parent-imports */

/* oxlint-disable oxc/no-async-await -- Await preserves the existing sequencing, rejection propagation, and cleanup behavior of this asynchronous operation. */
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

/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
/* oxlint-disable typescript/explicit-module-boundary-types -- This exported adapter derives its result from the schema or SDK contract; duplicating that type would erase inference or drift from the source. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the ordered validation, state transitions, and cleanup in one operation so their sequencing remains reviewable. */
/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
/* oxlint-disable oxc/no-async-await -- Await preserves the existing sequencing, rejection propagation, and cleanup behavior of this asynchronous operation. */
/* oxlint-disable oxc/no-optional-chaining -- Optional access deliberately propagates absence from the external or partially initialized data contract. */
/* oxlint-disable unicorn/no-null -- Null is an explicit SDK, serialized-data, or React absence sentinel; replacing it would change the contract. */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
/* oxlint-disable eslint/no-ternary -- This expression selects a value without introducing mutable intermediate state or changing evaluation order. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
// Validate every installed implementation before sync writes any registrations.
export const planObservability = async (cwd: string) => {
  const installed = await Promise.all(
    observabilityItems.map(async (item) => {
      const descriptor = path.join(cwd, `features/${item.name}/chatjs.json`);
      const present = await exists(descriptor);
      const files = await Promise.all(
        (item.files ?? []).map(async (file) => {
          const target = file.target?.replace(/^~\//u, "");
          if (!target) {
            throw new Error(
              `Observability file needs an explicit target: ${file.path}`
            );
          }
          return { present: await exists(path.join(cwd, target)), target };
        })
      );
      if (!present) {
        if (files.some((file): boolean => file.present)) {
          throw new Error(
            `${item.name} is missing its descriptor. Run chat-js add ${item.name} to complete installation.`
          );
        }
        return null;
      }
      const definition = featureDefinitionSchema.parse(
        JSON.parse(await readFile(descriptor, "utf-8"))
      );
      if (definition.id !== item.name) {
        throw new Error(
          `Feature descriptor id must match its directory: ${item.name}`
        );
      }
      const missing = files.filter((file): boolean => !file.present);
      if (missing.length > 0) {
        throw new Error(
          `${item.name} installation is incomplete. Missing: ${missing.map((file): string => file.target).join(", ")}. Run chat-js add ${item.name}.`
        );
      }
      return item.name;
    })
  );
  const ids = installed.filter((id) => id !== null);
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
        content: `// Generated by chat-js sync.\n${imports ? `${imports}\n` : ""}import type { InstalledLayoutComponent } from "@/lib/installation-contracts";\n\nexport const installedLayoutComponents: readonly {\n  id: string;\n  Component: InstalledLayoutComponent;\n}[] = ${layout.length > 0 ? `[\n${layout.map((id, index): string => `  { Component: Component${index}, id: "${id}" },`).join("\n")}\n]` : "[]"};\n`,
        file: path.join(cwd, "features/installed-layout.ts"),
      },
      {
        content: `// Generated by chat-js sync.\n${instrumentationImport}import type { InstrumentationRegistration } from "@/lib/installation-contracts";\n\nexport const installedInstrumentation: readonly InstrumentationRegistration[] =\n  [${ids.includes("langfuse") ? "register" : ""}];\n`,
        file: path.join(cwd, "features/installed-instrumentation.ts"),
      },
    ],
    ids,
  };
};
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/no-ternary */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable unicorn/no-null */
/* oxlint-enable oxc/no-optional-chaining */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable typescript/explicit-module-boundary-types */
/* oxlint-enable import/no-named-export */
/* oxlint-enable eslint/max-statements */
/* oxlint-enable import/group-exports */

/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
/* oxlint-disable oxc/no-async-await -- Await preserves the existing sequencing, rejection propagation, and cleanup behavior of this asynchronous operation. */
/* oxlint-disable oxc/no-optional-chaining -- Optional access deliberately propagates absence from the external or partially initialized data contract. */
/* oxlint-disable unicorn/no-null -- Null is an explicit SDK, serialized-data, or React absence sentinel; replacing it would change the contract. */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
/* oxlint-disable typescript/promise-function-async -- Return the existing promise directly to preserve its identity and the current synchronous-throw boundary. */
// Creation only: reset demo selections. Sync/add never remove implementations.
export const initializeObservability = async (cwd: string): Promise<void> => {
  await Promise.all(
    observabilityItems.map((item): Promise<void> =>
      rm(path.join(cwd, "features", item.name), {
        force: true,
        recursive: true,
      })
    )
  );
  const manifestPath = path.join(cwd, "package.json");
  if (!(await exists(manifestPath))) {
    return;
  }
  // oxlint-disable-next-line typescript/no-unsafe-assignment -- Dependency removal must preserve unrelated package manifest fields; adopting a stricter manifest schema requires compatibility decisions.
  const manifest = JSON.parse(await readFile(manifestPath, "utf-8"));
  for (const dependency of [
    "@vercel/analytics",
    "@vercel/speed-insights",
    "@vercel/otel",
    "langfuse-vercel",
    "langfuse",
  ]) {
    // oxlint-disable-next-line typescript/no-unsafe-member-access -- Dependency removal must preserve unrelated package manifest fields; adopting a stricter manifest schema requires compatibility decisions.
    delete manifest.dependencies?.[dependency];
  }
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
};
/* oxlint-enable typescript/promise-function-async */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable unicorn/no-null */
/* oxlint-enable oxc/no-optional-chaining */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable import/no-named-export */
/* oxlint-enable import/group-exports */
