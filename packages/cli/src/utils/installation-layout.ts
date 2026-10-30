import { lstat, readdir } from "node:fs/promises";
import path from "node:path";
import { preflight } from "./preflight";

const exists = async (file: string): Promise<boolean> => {
  try {
    await lstat(file);
    return true;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
};

// A layout change must never silently generate registrations the app cannot read.
export const assertCurrentInstallationLayout = async (
  cwd: string
): Promise<void> => {
  await preflight(cwd, ["features/.layout-check"]);
  const features = await readdir(path.join(cwd, "features"), {
    withFileTypes: true,
  }).catch((error: unknown) => {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return [];
    }
    throw error;
  });
  const markers = [
    "composition/generated",
    ".chatjs",
    "tools/chatjs/tools.ts",
    "tools/chatjs/ui.ts",
    "tools/chatjs/custom-tools.ts",
    "tools/chatjs/custom-ui.ts",
    "features/installed.ts",
    ...features
      .filter((entry) => entry.isDirectory() || entry.isSymbolicLink())
      .map((entry) => `features/${entry.name}/chatjs.json`),
  ];
  const found = await Promise.all(
    markers.map(async (marker) =>
      (await exists(path.join(cwd, marker))) ? marker : null
    )
  );
  const legacy = found.filter((marker) => marker !== null);
  if (legacy.length > 0) {
    throw new Error(
      `Legacy ChatJS installation layout detected: ${legacy.join(", ")}. Before add, sync, or remove, move generated registrations to chatjs/generated and installation metadata/backups from .chatjs to chatjs without overwriting existing files. Keep app-owned registrations in composition/custom and integrations, and plugin implementations/descriptors in plugins/<id>. Update app imports and plugin descriptors/factories to the current template contract, then remove the old registration files. Existing files were not changed.`
    );
  }
};
