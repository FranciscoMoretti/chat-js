import { builtinStorageFields } from "../../storage-fields";
import { builtInStorageProviders } from "./providers";
import { getStorageEnvironmentRequirements } from "./environment";
import { storageDefinitionSchema } from "../../metadata";

import type { CreateIcon } from "../../create-icons";
import type { SupportedStorageId } from "./providers";

const icons: Partial<Record<SupportedStorageId, CreateIcon>> = {
  memory: "minus",
  "vercel-blob": "setup/vercel",
  r2: "setup/cloudflare",
  s3: "setup/aws-s3",
};

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
  const configFields = builtinStorageFields(id, provider.env.config ?? []);
  return {
    description:
      id === "memory"
        ? "Files are temporary and disappear when the server restarts."
        : provider.description,
    files: [
      {
        path: `src/storage/${id}/storage-provider.ts`,
        target: "~/chatjs/providers/storage.ts",
        type: "registry:file" as const,
      },
    ],
    meta: {
      icon: icons[id],
      chatjs: storageDefinitionSchema.parse({
        // Older clients interpret every configKeys entry as required.
        configKeys: configFields
          .filter((field) => field.optional !== true)
          .map(({ key }) => key),
        configFields,
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
    title: id === "memory" ? "No persistent storage" : provider.name,
    type: "registry:item" as const,
  };
});
