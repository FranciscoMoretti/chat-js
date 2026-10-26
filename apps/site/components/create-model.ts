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

export const readInstallationSelection = (
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
