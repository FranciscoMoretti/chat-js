import { lstat } from "node:fs/promises";
import path from "node:path";

export const validateRelativePath = (file: string): void => {
  if (
    !file ||
    file.includes("\\") ||
    file.includes("\0") ||
    file.includes(":") ||
    path.posix.isAbsolute(file) ||
    file.split("/").some((part) => !part || part === "." || part === "..")
  ) {
    throw new Error(`Unsafe registry-mirror path: ${file}`);
  }
};

/** Validate existing parents and leaves before publication; never follow symlinks. */
export const validateTargets = async (
  root: string,
  files: readonly string[]
): Promise<void> => {
  const base = await lstat(root);
  if (!base.isDirectory() || base.isSymbolicLink()) {
    throw new Error(`Registry-mirror destination must be a directory: ${root}`);
  }
  for (const file of files) {
    validateRelativePath(file);
    let current = root;
    const parts = file.split("/");
    for (const [index, part] of parts.entries()) {
      current = path.join(current, part);
      // oxlint-disable-next-line no-await-in-loop -- Validate each parent before traversing its child.
      const entry = await lstat(current).catch((error: unknown) => {
        if (
          error instanceof Error &&
          "code" in error &&
          error.code === "ENOENT"
        ) {
          return;
        }
        throw error;
      });
      if (
        entry &&
        (entry.isSymbolicLink() ||
          (index === parts.length - 1 ? !entry.isFile() : !entry.isDirectory()))
      ) {
        throw new Error(`Invalid or symlinked registry-mirror target: ${file}`);
      }
    }
  }
};
