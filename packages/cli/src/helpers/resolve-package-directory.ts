// oxlint-disable-next-line import/no-nodejs-modules -- The Node/Bun CLI reads, writes, and validates real project files with native filesystem APIs.
import { readFile } from "node:fs/promises";
// oxlint-disable-next-line import/no-nodejs-modules -- The Node/Bun CLI resolves installed packages from their declaring workspace using native module resolution.
import { createRequire } from "node:module";
// oxlint-disable-next-line import/no-nodejs-modules -- The Node/Bun CLI resolves platform-specific project and installation paths.
import pathModule from "node:path";

/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
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
    try {
      // oxlint-disable-next-line eslint/no-await-in-loop -- Each parent depends on the resolved entry's preceding directory.
      const manifestSource = await readFile(
        pathModule.join(directory, "package.json"),
        "utf-8"
      );
      const manifest: unknown = JSON.parse(manifestSource);
      if (
        typeof manifest === "object" &&
        // oxlint-disable-next-line unicorn/no-null -- JSON permits null; exclude it before checking the parsed object's name.
        manifest !== null &&
        "name" in manifest &&
        manifest.name === packageName
      ) {
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
/* oxlint-enable eslint/max-statements */
