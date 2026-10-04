import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { z } from "zod";

/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { builtInStorage } from "../../../registry/src/storage/catalog";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import type { StorageSelection } from "../registry/storage";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable import/no-relative-parent-imports -- The provider generator shares the package-local registration emitter in formatter order. */
import { generatedRegistrationSource } from "../utils/generated-registration-source";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { preflight } from "../utils/preflight";
/* oxlint-enable import/no-relative-parent-imports */
import type { ReadonlyInput } from "./readonly-input";

const CONFIG_JSON_INDENTATION_SPACES = 2;
const MISSING_ENV_MARKER = -1;
const ENV_SOURCE_START = 0;

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

const STORAGE_ENV_START = "# <chatjs-storage-provider>";
const STORAGE_ENV_END = "# </chatjs-storage-provider>";

const withoutStorageEnvBlock = (source: string): string => {
  const from = source.indexOf(STORAGE_ENV_START);
  const to = source.indexOf(STORAGE_ENV_END);
  return from !== MISSING_ENV_MARKER && to >= from
    ? source.slice(ENV_SOURCE_START, from) +
        source.slice(to + STORAGE_ENV_END.length)
    : source;
};

const storageEnvSource = (
  source: string,
  definition: ReadonlyInput<StorageSelection["definition"]>
): string => {
  let env = withoutStorageEnvBlock(source);
  const variables = [
    ...new Set(
      definition.envRequirements.flatMap(
        (
          requirement: ReadonlyInput<
            StorageSelection["definition"]["envRequirements"][number]
          >
        ) => requirement.options.flat()
      )
    ),
  ];
  env += `\n${STORAGE_ENV_START}\n# ${definition.id} storage\n`;
  for (const key of variables) {
    if (!new RegExp(`^${key}=`, "mu").test(env)) {
      env += `${key}=\n`;
    }
  }
  for (const key of definition.optionalEnv) {
    env += `# ${key}=\n`;
  }
  return `${env}${STORAGE_ENV_END}\n`;
};

/**
 * Configure the installed source without evaluating it or editing dependencies.
 * @param destination Project root receiving storage-options.ts and its env block.
 * @param selection Resolved descriptor and non-secret native storage options.
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
  const examplePath = path.join(destination, ".env.example");
  const env = await readFile(examplePath, "utf-8").catch((error: unknown) => {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return "";
    }
    throw error;
  });
  await writeFile(examplePath, storageEnvSource(env, definition));
};
export {
  configureStorageProvider,
  INSTALLABLE_STORAGE_PROVIDERS,
  parseStorageOptions,
};
