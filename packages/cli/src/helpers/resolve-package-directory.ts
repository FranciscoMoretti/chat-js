import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const { dirname, join, parse } = path;

/** Resolve an installed package from the workspace that declares the dependency. */
export const resolvePackageDirectory = async (
  packageName: string,
  resolveFrom: string
): Promise<string> => {
  const resolveDependency = createRequire(
    join(resolveFrom, "package.json")
  ).resolve;
  let directory = dirname(resolveDependency(packageName));
  const filesystemRoot = parse(directory).root;

  while (directory !== filesystemRoot) {
    try {
      // oxlint-disable-next-line eslint/no-await-in-loop -- Each parent depends on the resolved entry's preceding directory.
      const manifestSource = await readFile(
        join(directory, "package.json"),
        "utf-8"
      );
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
    directory = dirname(directory);
  }

  throw new Error(`Could not locate the installed ${packageName} package.`);
};
