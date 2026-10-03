/* oxlint-disable import/no-nodejs-modules -- This code runs on the Node/Bun server or installer and requires the built-in operating-system API. */
import { readFile } from "node:fs/promises";
/* oxlint-enable import/no-nodejs-modules */
/* oxlint-disable import/no-nodejs-modules -- This code runs on the Node/Bun server or installer and requires the built-in operating-system API. */
import { createRequire } from "node:module";
/* oxlint-enable import/no-nodejs-modules */
/* oxlint-disable import/no-nodejs-modules -- This code runs on the Node/Bun server or installer and requires the built-in operating-system API. */
import pathModule from "node:path";
/* oxlint-enable import/no-nodejs-modules */

/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable jsdoc/require-returns -- The comment documents lifecycle behavior; the TypeScript return contract remains the authoritative result description. */
/* oxlint-disable jsdoc/require-param -- This comment documents the API invariant; parameter names and TypeScript annotations describe the inputs without duplicating them in tags. */
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
/* oxlint-enable jsdoc/require-param */
/* oxlint-enable jsdoc/require-returns */
/* oxlint-enable eslint/max-statements */
