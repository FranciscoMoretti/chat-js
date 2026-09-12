import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { getProvider, PROVIDER_NAMES } from "files-sdk/providers";
import { z } from "zod";

import { storageDefinitionSchema } from "../../metadata";
import { getStorageEnvironmentRequirements } from "./environment";

const sdkPackage = z
  .object({
    version: z.string(),
    peerDependencies: z.record(z.string(), z.string()),
  })
  .parse(
    JSON.parse(
      readFileSync(
        path.join(
          path.dirname(fileURLToPath(import.meta.resolve("files-sdk"))),
          "../package.json"
        ),
        "utf-8"
      )
    )
  );

const unsupported = new Set(["box", "bun-s3", "convex", "fs"]);
export const builtInStorage = PROVIDER_NAMES.filter(
  (id) => !unsupported.has(id)
).map((id) => {
  const provider = getProvider(id);
  if (!provider) {
    throw new Error(`Missing Files SDK provider: ${id}`);
  }
  return {
    name: `${id}-storage`,
    type: "registry:item" as const,
    title: provider.name,
    description: provider.description,
    dependencies: [
      `files-sdk@${sdkPackage.version}`,
      ...provider.peerDeps.map((peer) => {
        const version = sdkPackage.peerDependencies[peer];
        if (!version) {
          throw new Error(`Missing Files SDK peer version: ${peer}`);
        }
        return `${peer}@${version}`;
      }),
    ],
    files: [
      {
        path: `src/storage/${id}/storage-provider.ts`,
        type: "registry:file" as const,
        target: "~/lib/storage-provider.ts",
      },
    ],
    meta: {
      chatjs: storageDefinitionSchema.parse({
        contractVersion: 1,
        kind: "storage",
        id,
        configKeys: provider.env.config ?? [],
        envRequirements: getStorageEnvironmentRequirements(id).map(
          (requirement) => ({
            description: requirement.description,
            options: requirement.options.map((option) =>
              option.map(({ key }) => key)
            ),
          })
        ),
        optionalEnv: provider.env.optional?.map(({ key }) => key) ?? [],
      }),
    },
  };
});
