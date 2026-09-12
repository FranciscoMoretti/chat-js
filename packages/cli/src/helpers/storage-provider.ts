import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { z } from "zod";

import { builtInStorage } from "../../../registry/src/storage/catalog";
import type { StorageSelection } from "../registry/storage";
import { preflight } from "../utils/preflight";

export const INSTALLABLE_STORAGE_PROVIDERS = builtInStorage.filter(
  (item) => item.meta.chatjs.id !== "memory"
);

export const parseStorageOptions = (value: string): Record<string, unknown> => {
  try {
    return z.record(z.string(), z.unknown()).parse(JSON.parse(value));
  } catch {
    throw new Error("Storage config must be a valid JSON object.");
  }
};

/** Configure the installed source without evaluating it or editing dependencies. */
export const configureStorageProvider = async (
  destination: string,
  selection: StorageSelection
): Promise<void> => {
  await preflight(destination, ["lib/storage-options.ts", ".env.example"]);
  const { definition, options } = selection;
  await writeFile(
    path.join(destination, "lib/storage-options.ts"),
    `import type { EnvRequirement } from "./config-requirements";
import type { createStorageAdapter } from "./storage-provider";

export const storageOptions = ${JSON.stringify(options, null, 2)} satisfies Parameters<typeof createStorageAdapter>[0];
export const storageId = ${JSON.stringify(definition.id)};
export const storageEnvRequirements: EnvRequirement[] = ${JSON.stringify(definition.envRequirements, null, 2)};
`
  );
  const examplePath = path.join(destination, ".env.example");
  let env = await readFile(examplePath, "utf-8").catch((error) => {
    if (error.code === "ENOENT") {
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
