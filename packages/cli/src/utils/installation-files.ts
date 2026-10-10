// oxlint-disable-next-line import/no-nodejs-modules -- Installation reads file bytes and enumerates real directories.
import { readFile, readdir } from "node:fs/promises"; // oxlint-disable-next-line import/no-nodejs-modules -- Installation walks native directory entries and rejects symbolic links.
import type { Dirent } from "node:fs";

// oxlint-disable-next-line import/no-nodejs-modules -- Installation resolves native project paths.
import path from "node:path";

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve optionalFile's awaited sequencing and rejected-Promise behavior. */
const optionalFile = async (file: string): Promise<Buffer | null> => {
  try {
    return await readFile(file);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      // oxlint-disable-next-line unicorn/no-null -- Snapshot absence must differ from an existing zero-byte Buffer during rollback.
      return null;
    }
    throw error;
  }
};
/* oxlint-enable oxc/no-async-await */

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve directoryFiles's awaited sequencing and rejected-Promise behavior. */
const directoryFiles = async (
  cwd: string,
  directory: string
): Promise<string[]> => {
  const entries = await readdir(path.join(cwd, directory), {
    withFileTypes: true,
  });
  const files = await Promise.all(
    entries.map(async (entry: Readonly<Dirent>) => {
      const target = `${directory}/${entry.name}`;
      if (entry.isSymbolicLink()) {
        throw new Error(`Invalid or symlinked ChatJS target: ${target}`);
      }
      if (entry.isDirectory()) {
        return await directoryFiles(cwd, target);
      }
      return [target];
    })
  );
  return files.flat();
};
/* oxlint-enable oxc/no-async-await */

/* oxlint-disable import/no-named-export -- These package-private installation readers are separate named capabilities; the enabled no-default-export convention rejects the default alternative. */
export { directoryFiles, optionalFile };
/* oxlint-enable import/no-named-export */
