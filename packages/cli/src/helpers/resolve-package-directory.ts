import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import pathModule from "node:path";

/** Resolve an installed package from the workspace that declares the dependency. */
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
    try {
      // oxlint-disable-next-line eslint/no-await-in-loop -- Each parent depends on the resolved entry's preceding directory.
      const manifestSource = await readFile(
        pathModule.join(directory, "package.json"),
        "utf-8"
      );
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Package discovery reads only the manifest name and leaves unrelated package metadata untouched.
      const manifest = JSON.parse(manifestSource) as { name?: string };
      if (manifest.name === packageName) {
        return directory;
      }
    } catch (error) {
      if (
        !(error instanceof Error) ||
        !("code" in error) ||
        error.code !== "ENOENT"
      ) {
        throw error;
      }
    }
    directory = pathModule.dirname(directory);
  }

  throw new Error(`Could not locate the installed ${packageName} package.`);
};
