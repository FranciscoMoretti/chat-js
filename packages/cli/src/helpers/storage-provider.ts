import type { ReadonlyInput } from "./readonly-input";
import type { StorageSelection } from "#cli/registry/storage";
import { builtInStorage } from "../../../registry/src/storage/catalog";
import { generatedRegistrationSource } from "#cli/utils/generated-registration-source";
import path from "node:path";
import { preflight } from "#cli/utils/preflight";
import { updateEnvironmentExample } from "#cli/utils/environment-example";
import { writeFile } from "node:fs/promises";
import { z } from "zod";

const CONFIG_JSON_INDENTATION_SPACES = 2;

const serializedConfigValue = (
  value: unknown
): ReturnType<typeof JSON.stringify> =>
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

export const storageOptions = ${serializedConfigValue(options)} satisfies Parameters<typeof createStorageAdapter>[0];
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
export {
  configureStorageProvider,
  INSTALLABLE_STORAGE_PROVIDERS,
  parseStorageOptions,
};
