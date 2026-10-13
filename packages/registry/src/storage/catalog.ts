import { PROVIDER_NAMES, getProvider } from "files-sdk/providers";
import { getStorageEnvironmentRequirements } from "./environment";
import { readFileSync } from "node:fs";
import { storageDefinitionSchema } from "../../metadata";
import { z } from "zod";

const sdkPackageSchema = z.object({
  peerDependencies: z.record(z.string(), z.string()),
  version: z.string(),
});
const sdkPackagePath = new URL(
  "../package.json",
  import.meta.resolve("files-sdk")
);
const sdkPackageContents = readFileSync(sdkPackagePath, "utf-8");
const sdkPackage = sdkPackageSchema.parse(JSON.parse(sdkPackageContents));

const getOptionalEnvironmentKeys = (
  variables: readonly Readonly<{ key: string }>[] | undefined
): string[] => {
  if (!variables) {
    return [];
  }
  return variables.map(({ key }: Readonly<{ key: string }>) => key) ?? [];
};

const unsupported = new Set(["box", "bun-s3", "convex", "fs", "s3-fetch"]);
type StorageEnvironmentRequirementReader = Readonly<{
  description: string;
  options: readonly (readonly Readonly<{ key: string }>[])[];
}>;
export const builtInStorage = PROVIDER_NAMES.filter(
  (id) => !unsupported.has(id)
).map((id) => {
  const provider = getProvider(id);
  if (!provider) {
    throw new Error(`Missing Files SDK provider: ${id}`);
  }
  return {
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
    description: provider.description,
    files: [
      {
        path: `src/storage/${id}/storage-provider.ts`,
        target: "~/lib/storage-provider.ts",
        type: "registry:file" as const,
      },
    ],
    meta: {
      chatjs: storageDefinitionSchema.parse({
        configKeys: provider.env.config ?? [],
        contractVersion: 1,
        envRequirements: getStorageEnvironmentRequirements(id).map(
          (requirement: StorageEnvironmentRequirementReader) => ({
            description: requirement.description,
            options: requirement.options.map((option) =>
              option.map(({ key }) => key)
            ),
          })
        ),
        id,
        kind: "storage",
        optionalEnv: getOptionalEnvironmentKeys(provider.env.optional),
      }),
    },
    name: `${id}-storage`,
    title: provider.name,
    type: "registry:item" as const,
  };
});
