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
  const selection = installationSelectionSchema.parse(installation);
  const args = [
    "bunx",
    "chat-js@alpha",
    "create",
    "my-chat",
    "--yes",
    "--installation",
    JSON.stringify(selection),
    "--",
    "--preset",
    encodePreset(preset),
    "--base",
    base,
  ];
  return args.map(quoteArgument).join(" ");
};

export type CreateProvider = Readonly<{
  id: string;
  title: string;
  configKeys?: readonly string[];
}>;

const readEncodedInstallation = (
  encoded: string,
  gateways: readonly CreateProvider[],
  storageProviders: readonly CreateProvider[]
): InstallationSelection | null => {
  try {
    const parsed = installationSelectionSchema.safeParse(JSON.parse(encoded));
    if (!parsed.success) {
      return null;
    }
    const selection = parsed.data;
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

export const readInstallationSelection = (
  query: URLSearchParams,
  gateways: readonly CreateProvider[],
  storageProviders: readonly CreateProvider[]
) => {
  const encoded = query.get("installation");
  if (encoded !== null) {
    return readEncodedInstallation(encoded, gateways, storageProviders);
  }
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
