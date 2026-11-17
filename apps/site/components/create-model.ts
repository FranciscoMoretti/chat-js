import cliPackage from "../../../packages/cli/package.json";
import {
  encodeAppPreset,
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
  configKeys?: readonly string[];
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
