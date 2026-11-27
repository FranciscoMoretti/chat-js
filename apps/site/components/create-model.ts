import { normalizeStorageOptions } from "../../../packages/registry/storage-fields";
import type { StorageField } from "../../../packages/registry/storage-fields";
import cliPackage from "../../../packages/cli/package.json";
import {
  encodeAppPreset,
  readInstallationInput,
} from "../../../packages/registry/app-preset";
import { encodePreset } from "shadcn/preset";
import type { PresetBase, PresetConfig } from "shadcn/preset";
import {
  installationSelectionSchema,
  defaultAuthProviders,
} from "../../../packages/registry/installation";
import type { InstallationSelection } from "../../../packages/registry/installation";

import { createCatalog } from "../../../packages/registry/create-catalog";

export const startingInstallation = installationSelectionSchema.parse({
  auth: defaultAuthProviders,
  sandbox: createCatalog.sandboxProvider.defaultValue,
  gateway: createCatalog.gateway.defaultValue,
  storage: { source: createCatalog.storageProvider.defaultValue },
});

const quoteArgument = (value: string): string =>
  /^[a-zA-Z0-9_./:@=-]+$/u.test(value)
    ? value
    : `'${value.replaceAll("'", "'\\''")}'`;

export const createCommand = (
  preset: Readonly<PresetConfig>,
  base: PresetBase,
  installation: Readonly<InstallationSelection>
): string => {
  const code = encodeAppPreset(installation);
  const args = [
    "bunx",
    `chat-js@${cliPackage.version}`,
    "create",
    "my-chat",
    "--yes",
    "--app-preset",
    code,
    "--",
    "--preset",
    encodePreset(preset),
    "--base",
    base,
  ];
  return args.map(quoteArgument).join(" ");
};

/** One URL field carries the entire editable application configuration. */
export const encodeInstallationQuery = (selection: InstallationSelection) => ({
  app: encodeAppPreset(selection),
});

export type CreateProvider = Readonly<{
  id: string;
  title: string;
  fields?: readonly StorageField[];
}>;

export const readInstallationSelection = (
  query: URLSearchParams,
  gateways: readonly CreateProvider[],
  storageProviders: readonly CreateProvider[]
): InstallationSelection | null => {
  const encoded = query.get("app");
  if (encoded === null) {
    return startingInstallation;
  }
  try {
    const selection = readInstallationInput(encoded);
    const provider = storageProviders.find(
      (item) => item.id === selection.storage?.source
    );
    if (
      selection.gateway !== undefined &&
      !gateways.some((item) => item.id === selection.gateway)
    ) {
      return null;
    }
    if (selection.storage) {
      if (!provider) {
        return null;
      }
      const fields = provider.fields ?? [];
      const options = normalizeStorageOptions(
        fields,
        selection.storage.options
      );
      if (
        Object.entries(options).some(([key, value]) => {
          const field = fields.find((candidate) => candidate.key === key);
          // An editable URL can contain an incomplete value. Final validation
          // reports field errors without making the entire draft inaccessible.
          return (
            !field ||
            (typeof value !== "string" &&
              !(field.type === "port" && typeof value === "number"))
          );
        })
      ) {
        return null;
      }
      selection.storage.options = options;
    }
    return selection;
  } catch {
    return null;
  }
};
