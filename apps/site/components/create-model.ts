import {
  encodeInstallationInput,
  readInstallationInput,
} from "../../../packages/registry/app-preset";
import { encodePreset } from "shadcn/preset";
import type { PresetBase, PresetConfig } from "shadcn/preset";
import { installationSelectionSchema } from "../../../packages/registry/installation";
import type { InstallationSelection } from "../../../packages/registry/installation";

export const startingInstallation = installationSelectionSchema.parse({
  gateway: "vercel",
  storage: { source: "vercel-blob" },
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
  const { code, storageConfig } = encodeInstallationInput(installation);
  const args = [
    "bunx",
    "chat-js@alpha",
    "create",
    "my-chat",
    "--yes",
    "--app-preset",
    code,
    ...(storageConfig === undefined ? [] : ["--storage-config", storageConfig]),
    "--",
    "--preset",
    encodePreset(preset),
    "--base",
    base,
  ];
  return args.map(quoteArgument).join(" ");
};

/** Canonical URL state. Preserve unknown/custom IDs so imported links stay editable. */
export const encodeInstallationQuery = (selection: InstallationSelection) => {
  let app: string | null = null;
  let installation: string | null = null;
  let storageConfig: string | null = null;
  try {
    const encoded = encodeInstallationInput(selection);
    app = encoded.code;
    storageConfig = encoded.storageConfig ?? null;
  } catch {
    installation = JSON.stringify(selection);
  }
  return {
    app,
    installation,
    "storage-config": storageConfig,
    gateway: null,
    storage: null,
    uploads: null,
  };
};

export type CreateProvider = Readonly<{
  id: string;
  title: string;
  configKeys?: readonly string[];
}>;

const readEncodedInstallation = (
  encoded: string,
  gateways: readonly CreateProvider[],
  storageProviders: readonly CreateProvider[],
  storageConfig?: string
): InstallationSelection | null => {
  try {
    const selection = readInstallationInput(encoded, storageConfig);
    const provider = storageProviders.find(
      (item) => item.id === selection.storage?.source
    );
    if (
      selection.gateway !== undefined &&
      !gateways.some((item) => item.id === selection.gateway)
    ) {
      return null;
    }
    if (
      selection.storage &&
      (!provider ||
        Object.entries(selection.storage.options).some(
          ([key, value]) =>
            provider.configKeys?.includes(key) !== true ||
            typeof value !== "string"
        ))
    ) {
      return null;
    }
    return selection;
  } catch {
    return null;
  }
};

const readLegacyInstallationFields = (
  query: URLSearchParams,
  gateways: readonly CreateProvider[],
  storageProviders: readonly CreateProvider[]
) => {
  const gateway = query.get("gateway") ?? startingInstallation.gateway;
  const storage = query.get("storage") ?? startingInstallation.storage?.source;
  const uploads = query.get("uploads") ?? "false";
  let options: unknown = {};
  try {
    options = JSON.parse(query.get("storage-config") ?? "{}");
  } catch {
    return null;
  }
  const storageSelection = installationSelectionSchema.shape.storage.safeParse({
    source: storage,
    options,
  });
  const provider = storageProviders.find((item) => item.id === storage);
  if (
    !gateways.some((item) => item.id === gateway) ||
    !storageProviders.some((item) => item.id === storage) ||
    !["true", "false"].includes(uploads) ||
    !storageSelection.success ||
    Object.entries(storageSelection.data?.options ?? {}).some(
      ([key, value]) =>
        provider?.configKeys?.includes(key) !== true ||
        typeof value !== "string"
    )
  ) {
    return null;
  }
  return installationSelectionSchema.parse({
    gateway,
    plugins: uploads === "true" ? ["attachment-uploads"] : [],
    ...(uploads === "true" ? { sandbox: "vercel" } : {}),
    storage: storageSelection.data,
  });
};

export const readInstallationSelection = (
  query: URLSearchParams,
  gateways: readonly CreateProvider[],
  storageProviders: readonly CreateProvider[]
) => {
  const app = query.get("app");
  const legacy = query.get("installation");
  if (app !== null && (legacy !== null || app.trim().startsWith("{"))) {
    return null;
  }
  const encoded = app ?? legacy;
  if (encoded !== null) {
    return readEncodedInstallation(
      encoded,
      gateways,
      storageProviders,
      encoded.trim().startsWith("{")
        ? undefined
        : (query.get("storage-config") ?? undefined)
    );
  }
  return readLegacyInstallationFields(query, gateways, storageProviders);
};
