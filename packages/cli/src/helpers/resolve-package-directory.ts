import { createRequire } from "node:module";
import pathModule from "node:path";
import { readFile } from "node:fs/promises";

const hasMatchingPackageManifest = async (
  directory: string,
  packageName: string
): Promise<boolean> => {
  try {
    const manifestSource = await readFile(
      pathModule.join(directory, "package.json"),
      "utf-8"
    );
    const manifest: unknown = JSON.parse(manifestSource);
    return (
      typeof manifest === "object" &&
      manifest !== null &&
      "name" in manifest &&
      manifest.name === packageName
    );
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
};

/**
 * Resolve an installed package from the workspace that declares the dependency.
 * @param {string} packageName Package identifier to resolve through workspace dependencies.
 * @param {string} resolveFrom Workspace directory whose package.json anchors module resolution.
 * @returns {Promise<string>} The ancestor directory with that package's matching manifest name.
 */
export const resolvePackageDirectory = async (
  packageName: string,
  resolveFrom: string
): Promise<string> => {
  const resolveDependency = createRequire(
    pathModule.join(resolveFrom, "package.json")
  ).resolve;
  let directory = pathModule.dirname(resolveDependency(packageName));
  const filesystemRoot = pathModule.parse(directory).root;

  while (directory !== filesystemRoot) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- Inspect the current manifest before advancing to its parent; matches and non-missing errors stop traversal.
    if (await hasMatchingPackageManifest(directory, packageName)) {
      return directory;
    }
    directory = pathModule.dirname(directory);
  }

  throw new Error(`Could not locate the installed ${packageName} package.`);
};
