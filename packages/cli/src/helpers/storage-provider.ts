/* oxlint-disable import/no-nodejs-modules -- This code runs on the Node/Bun server or installer and requires the built-in operating-system API. */
import { readFile, writeFile } from "node:fs/promises";
/* oxlint-enable import/no-nodejs-modules */
/* oxlint-disable import/no-nodejs-modules -- This code runs on the Node/Bun server or installer and requires the built-in operating-system API. */
import path from "node:path";
/* oxlint-enable import/no-nodejs-modules */

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

/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
const INSTALLABLE_STORAGE_PROVIDERS = builtInStorage.filter(
  (item) => item.meta.chatjs.id !== "memory"
);
/* oxlint-enable typescript/prefer-readonly-parameter-types */

const parseStorageOptions = (value: string): Record<string, unknown> => {
  try {
    return z.record(z.string(), z.unknown()).parse(JSON.parse(value));
  } catch {
    throw new Error("Storage config must be a valid JSON object.");
  }
};

/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable jsdoc/require-param -- This comment documents the API invariant; parameter names and TypeScript annotations describe the inputs without duplicating them in tags. */
/* oxlint-disable unicorn/no-null -- Null is an explicit SDK, serialized-data, or React absence sentinel; replacing it would change the contract. */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
/* oxlint-disable eslint/id-length -- Short callback indices and coordinate keys match the surrounding collection or external data shape; renaming public keys would change the contract. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
/** Configure the installed source without evaluating it or editing dependencies. */
const configureStorageProvider = async (
  destination: string,
  selection: StorageSelection
): Promise<void> => {
  await preflight(destination, ["lib/storage-options.ts", ".env.example"]);
  const { definition, options } = selection;
  await writeFile(
    path.join(destination, "lib/storage-options.ts"),
    generatedRegistrationSource(`import type { EnvRequirement } from "./config-requirements";
import type { createStorageAdapter } from "./storage-provider";

/* oxlint-disable no-magic-numbers -- Tuple index zero selects the storage factory options parameter. */
export const storageOptions = ${JSON.stringify(options, null, 2)} satisfies Parameters<typeof createStorageAdapter>[0];
/* oxlint-enable no-magic-numbers */
export const storageId = ${JSON.stringify(definition.id)};
export const storageEnvRequirements: EnvRequirement[] = ${JSON.stringify(definition.envRequirements, null, 2)};
`)
  );
  const examplePath = path.join(destination, ".env.example");
  let env = await readFile(examplePath, "utf-8").catch((error: unknown) => {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return "";
    }
    throw error;
  });
  const start = "# <chatjs-storage-provider>";
  const end = "# </chatjs-storage-provider>";
  const from = env.indexOf(start);
  const to = env.indexOf(end);
  if (from !== -1 && to >= from) {
    env = env.slice(0, from) + env.slice(to + end.length);
  }
  const variables = [
    ...new Set(definition.envRequirements.flatMap((r) => r.options.flat())),
  ];
  env += `\n${start}\n# ${definition.id} storage\n`;
  for (const key of variables) {
    if (!new RegExp(`^${key}=`, "mu").test(env)) {
      env += `${key}=\n`;
    }
  }
  for (const key of definition.optionalEnv) {
    env += `# ${key}=\n`;
  }
  env += `${end}\n`;
  await writeFile(examplePath, env);
};
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/id-length */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable unicorn/no-null */
/* oxlint-enable jsdoc/require-param */
/* oxlint-enable eslint/max-statements */
export {
  configureStorageProvider,
  INSTALLABLE_STORAGE_PROVIDERS,
  parseStorageOptions,
};
