import { builtInStorageProviders } from "./providers";
import { getStorageEnvironmentRequirements } from "./environment";
import { storageDefinitionSchema } from "../../metadata";

const getOptionalEnvironmentKeys = (
  variables: readonly Readonly<{ key: string }>[] | undefined
): string[] => {
  if (!variables) {
    return [];
  }
  return variables.map(({ key }: Readonly<{ key: string }>) => key) ?? [];
};

type StorageEnvironmentRequirementReader = Readonly<{
  description: string;
  options: readonly (readonly Readonly<{ key: string }>[])[];
}>;
export const storageItems = builtInStorageProviders.map((provider) => {
  const id = provider.slug;
  return {
    description: provider.description,
    files: [
      {
        path: `src/storage/${id}/storage-provider.ts`,
        target: "~/chatjs/providers/storage.ts",
        type: "registry:file" as const,
      },
    ],
    meta: {
      chatjs: storageDefinitionSchema.parse({
        // Memory accepts an optional initial seed; it needs no adapter options.
        configKeys: id === "memory" ? [] : (provider.env.config ?? []),
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
