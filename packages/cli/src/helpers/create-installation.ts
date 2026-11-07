import { registry } from "../../../registry/registry";
import {
  installationCatalog,
  resolveInstallationSelection,
} from "../../../registry/installation-catalog";
import { installationSelectionSchema } from "../../../registry/installation";

/** Create's complete catalog selection bypasses the interactive feature defaults. */
export const readCreateInstallation = (encoded: string) => {
  let input: unknown;
  try {
    input = JSON.parse(encoded);
  } catch {
    throw new Error("--installation must be a JSON installation selection.");
  }
  const resolution = resolveInstallationSelection(
    installationSelectionSchema.parse(input),
    installationCatalog(registry.items)
  );
  if (resolution.issues.length) {
    throw new Error(resolution.issues.join("\n"));
  }
  if (resolution.selection.gateway === undefined) {
    throw new Error("--installation requires a model gateway.");
  }
  return resolution.selection;
};

export const assertExclusiveInstallation = (
  options: Readonly<Record<string, unknown>>
): void => {
  if (options.installation === undefined) {
    return;
  }
  const conflicts = Object.keys(options).filter(
    (key) =>
      !["installation", "target", "yes"].includes(key) &&
      options[key] !== undefined
  );
  if (conflicts.length) {
    throw new Error(
      `--installation cannot be combined with other installation options: ${conflicts.join(", ")}. Native shadcn options still go after --.`
    );
  }
};
