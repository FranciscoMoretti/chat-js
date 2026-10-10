import type { ReadonlyInput } from "./readonly-input";
import type { StorageSelection } from "#cli/registry/storage";
// oxlint-disable-next-line import/no-relative-parent-imports -- This shared registry or app schema is outside the CLI package and is bundled into its published executable.
import { builtInStorage } from "../../../registry/src/storage/catalog";
import { generatedRegistrationSource } from "#cli/utils/generated-registration-source";
// oxlint-disable-next-line import/no-nodejs-modules -- The Node/Bun CLI resolves platform-specific project and installation paths.
import path from "node:path";
import { preflight } from "#cli/utils/preflight";
import { updateEnvironmentExample } from "#cli/utils/environment-example";
// oxlint-disable-next-line import/no-nodejs-modules -- The Node/Bun CLI reads, writes, and validates real project files with native filesystem APIs.
import { writeFile } from "node:fs/promises";
import { z } from "zod";

const CONFIG_JSON_INDENTATION_SPACES = 2;

const serializedConfigValue = (
  value: unknown
): ReturnType<typeof JSON.stringify> =>
  // oxlint-disable-next-line unicorn/no-null -- The native JSON null replacer preserves every storage option/environment field while two-space formatting keeps generated source bytes stable.
  JSON.stringify(value, null, CONFIG_JSON_INDENTATION_SPACES);

const INSTALLABLE_STORAGE_PROVIDERS = builtInStorage.filter(
  (item: ReadonlyInput<(typeof builtInStorage)[number]>) =>
    item.meta.chatjs.id !== "memory"
);

const parseStorageOptions = (value: string): Record<string, unknown> => {
  try {
    return z.record(z.string(), z.unknown()).parse(JSON.parse(value));
  } catch {
    throw new Error("Storage config must be a valid JSON object.");
  }
};

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve configureStorageProvider's awaited sequencing and rejected-Promise behavior. */
/**
 * Configure the installed source without evaluating it or editing dependencies.
 * @param {string} destination Project root receiving storage-options.ts and its env block.
 * @param {ReadonlyInput<StorageSelection>} selection Resolved descriptor and non-secret native storage options.
 */
const configureStorageProvider = async (
  destination: string,
  selection: ReadonlyInput<StorageSelection>
): Promise<void> => {
  await preflight(destination, ["lib/storage-options.ts", ".env.example"]);
  const { definition, options } = selection;
  await writeFile(
    path.join(destination, "lib/storage-options.ts"),
    generatedRegistrationSource(`import type { EnvRequirement } from "./config-requirements";
import type { createStorageAdapter } from "./storage-provider";

/* oxlint-disable no-magic-numbers -- Tuple index zero selects the storage factory options parameter. */
export const storageOptions = ${serializedConfigValue(options)} satisfies Parameters<typeof createStorageAdapter>[0];
/* oxlint-enable no-magic-numbers */
export const storageId = ${serializedConfigValue(definition.id)};
export const storageEnvRequirements: EnvRequirement[] = ${serializedConfigValue(definition.envRequirements)};
`)
  );
  await updateEnvironmentExample(destination, "storage-provider", [
    ...definition.envRequirements.flatMap((requirement) =>
      requirement.options.flat()
    ),
    ...definition.optionalEnv,
  ]);
};
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (configureStorageProvider, INSTALLABLE_STORAGE_PROVIDERS, parseStorageOptions); the enabled import/no-default-export convention rejects the default-export alternative. */
/* oxlint-enable oxc/no-async-await */
export {
  configureStorageProvider,
  INSTALLABLE_STORAGE_PROVIDERS,
  parseStorageOptions,
};
/* oxlint-enable import/no-named-export */
