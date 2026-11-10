import { registry } from "../../../registry/registry";
import {
  installationCatalog,
  resolveInstallationSelection,
} from "../../../registry/installation-catalog";
import { readInstallationInput } from "../../../registry/app-preset";

interface CreateInstallationInput {
  readonly appPreset?: string;
  readonly installation?: string;
  readonly storageConfig?: string;
}

export const assertExclusiveInstallation = (
  options: Readonly<Record<string, unknown>>
): void => {
  if (options.installation === undefined && options.appPreset === undefined) {
    return;
  }
  if (options.installation !== undefined && options.appPreset !== undefined) {
    throw new Error("--app-preset and --installation cannot be combined.");
  }
  const conflicts = Object.keys(options).filter(
    (key) =>
      !["appPreset", "installation", "storageConfig", "target", "yes"].includes(
        key
      ) && options[key] !== undefined
  );
  if (conflicts.length) {
    throw new Error(
      `--app-preset/--installation cannot be combined with other installation options: ${conflicts.join(", ")}. Native shadcn options still go after --.`
    );
  }
};

/** Create's complete catalog selection bypasses the interactive feature defaults. */
export const readCreateInstallation = (input: CreateInstallationInput) => {
  assertExclusiveInstallation({ ...input });
  const { appPreset, installation, storageConfig } = input;
  if (appPreset !== undefined && appPreset.trim().startsWith("{")) {
    throw new Error(
      "--app-preset expects a compact code; use --installation for JSON."
    );
  }
  if (installation !== undefined && !installation.trim().startsWith("{")) {
    throw new Error(
      "--installation expects JSON; use --app-preset for compact codes."
    );
  }
  const resolution = resolveInstallationSelection(
    readInstallationInput(appPreset ?? installation ?? "", storageConfig),
    installationCatalog(registry.items)
  );
  if (resolution.issues.length) {
    throw new Error(resolution.issues.join("\n"));
  }
  if (resolution.selection.gateway === undefined) {
    throw new Error("The app selection requires a model gateway.");
  }
  return resolution.selection;
};
