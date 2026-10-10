import { PROVIDER_NAMES, getProvider } from "files-sdk/providers";
import { getStorageEnvironmentRequirements } from "./environment";
/* oxlint-disable import/no-nodejs-modules -- This code runs on the Node/Bun server or installer and requires the built-in operating-system API. */
import { readFileSync } from "node:fs";
/* oxlint-enable import/no-nodejs-modules */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { storageDefinitionSchema } from "../../metadata";
/* oxlint-enable import/no-relative-parent-imports */
import { z } from "zod";

const sdkPackageSchema = z.object({
  peerDependencies: z.record(z.string(), z.string()),
  version: z.string(),
});
const sdkPackagePath = new URL(
  "../package.json",
  import.meta.resolve("files-sdk")
);
// oxlint-disable-next-line node/no-sync -- The catalog initializes its synchronous named export from the installed SDK manifest before registry construction.
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
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (builtInStorage); the enabled import/no-default-export convention rejects the default-export alternative. */
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
/* oxlint-enable import/prefer-default-export, import/no-named-export */
