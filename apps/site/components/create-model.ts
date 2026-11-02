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
  const args = ["bunx", "@chat-js/cli@beta", "create", "my-chat", "--yes"];
  if (selection.gateway !== undefined) {
    args.push("--gateway", selection.gateway);
  }
  args.push(
    selection.plugins.includes("projects") ? "--projects" : "--no-projects",
    selection.plugins.includes("attachment-uploads")
      ? "--attachments"
      : "--no-attachments"
  );
  if (selection.storage) {
    args.push("--storage-provider", selection.storage.source);
    if (Object.keys(selection.storage.options).length > 0) {
      args.push("--storage-config", JSON.stringify(selection.storage.options));
    }
  }
  const sandbox =
    selection.sandbox ??
    (selection.plugins.includes("attachment-uploads") ? "vercel" : undefined);
  if (typeof sandbox === "string" && sandbox !== "") {
    args.push("--sandbox-provider", sandbox);
  }
  args.push("--", "--preset", encodePreset(preset), "--base", base);
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

/** The current CLI has no generic plugin/tool selection flags. Never imply parity. */
export const unsupportedCreateSelections = (
  selection: Readonly<InstallationSelection>
): string[] => [
  ...selection.plugins
    .filter((id) => !["projects", "attachment-uploads"].includes(id))
    .map((id) => `Plugin ${id}: not represented by this command.`),
  ...selection.tools.map(
    (id) => `Tool ${id}: not represented by this command.`
  ),
  "CLI defaults may install additional tools; this command is not an exact installation manifest.",
];
