import type { ReadonlyInput } from "./readonly-input";
import type { StorageSelection } from "#cli/registry/storage";
import { builtInStorage } from "../../../registry/src/storage/catalog";
import { getStorageEnvironmentRequirements } from "../../../registry/src/storage/environment";
import { PROVIDER_NAMES } from "files-sdk/providers";
import {
  storageFields,
  storageOptionIssues,
  normalizeStorageOptions,
} from "../../../registry/storage-fields";
import { storageOptionsSchema } from "../../../registry/installation";
import { ProviderRequirementError } from "#cli/utils/installation-requirements";
import { readProviderLiteral } from "#cli/utils/provider-config";
import { generatedRegistrationSource } from "#cli/utils/generated-registration-source";
import path from "node:path";
import { preflight } from "#cli/utils/preflight";
import { updateEnvironmentExample } from "#cli/utils/environment-example";
import { mkdir, writeFile } from "node:fs/promises";
import { createCatalog } from "../../../registry/create-catalog";

const CONFIG_JSON_INDENTATION_SPACES = 2;

const serializedConfigValue = (
  value: unknown
): ReturnType<typeof JSON.stringify> =>
  JSON.stringify(value, null, CONFIG_JSON_INDENTATION_SPACES);

const APPEND_DELETE_COUNT = 0;

type StorageRequirementInput = ReadonlyInput<
  ReturnType<typeof getStorageEnvironmentRequirements>[number]
>;

const registryStorageRequirement = (
  requirement: StorageRequirementInput
): StorageSelection["definition"]["envRequirements"][number] => ({
  description: requirement.description,
  options: requirement.options.flatMap((option) => {
    let alternatives: string[][] = [[]];
    for (const variable of option) {
      alternatives = alternatives.flatMap((alternative: readonly string[]) =>
        [variable.key, ...variable.aliases].map((key) =>
          alternative.toSpliced(alternative.length, APPEND_DELETE_COUNT, key)
        )
      );
    }
    return alternatives;
  }),
});

export const readInstalledStorageOptions = async (cwd: string) =>
  storageOptionsSchema.parse(
    await readProviderLiteral(
      cwd,
      "chatjs/providers/storage-options.ts",
      "storageOptions"
    )
  );

export const applyStorageOptions = (
  selection: StorageSelection,
  input: Record<string, unknown>
): StorageSelection => {
  const fields = storageFields(selection.definition, selection.source);
  const options = normalizeStorageOptions(fields, input);
  const issues = storageOptionIssues(fields, options);
  if (issues.length) {
    throw new ProviderRequirementError(
      "storage",
      `${selection.definition.id}: ${issues.join(" ")} Pass --storage-config or configure File storage.`
    );
  }
  selection.options = options;
  // An external item can share an ID with a built-in while declaring its own credentials.
  const builtin = builtInStorage.find(
    (item) => selection.source === `@chatjs/${item.name}`
  );
  const providerId = PROVIDER_NAMES.find(
    (id) => id === builtin?.meta.chatjs.id
  );
  if (providerId !== undefined) {
    selection.definition.envRequirements = getStorageEnvironmentRequirements(
      providerId,
      options
    ).map(registryStorageRequirement);
  }
  return selection;
};

const parseStorageOptions = (value: string): Record<string, unknown> => {
  const result = createCatalog.storageConfig.schema.safeParse(value);
  if (!result.success) {
    throw new Error("Storage config must be a valid JSON object.");
  }
  return result.data;
};

const storageConfigurationTargets = [
  "chatjs/providers/storage-options.ts",
  ".env.example",
];

/**
 * Configure the installed source without evaluating it or editing dependencies.
 * @param {string} destination Project root receiving storage-options.ts and its env block.
 * @param {ReadonlyInput<StorageSelection>} selection Resolved descriptor and non-secret native storage options.
 */
const configureStorageProvider = async (
  destination: string,
  selection: ReadonlyInput<StorageSelection>
): Promise<void> => {
  await preflight(destination, storageConfigurationTargets);
  await mkdir(path.join(destination, "chatjs/providers"), { recursive: true });
  const { definition, options } = selection;
  await writeFile(
    path.join(destination, "chatjs/providers/storage-options.ts"),
    generatedRegistrationSource(`import type { EnvRequirement } from "@/lib/config-requirements";
import type { createStorageAdapter } from "@/chatjs/providers/storage";

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
  storageConfigurationTargets,
  parseStorageOptions,
};
