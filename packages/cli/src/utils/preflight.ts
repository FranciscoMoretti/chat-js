import { lstat } from "node:fs/promises";
import path from "node:path";

import { isSafeTarget } from "./is-safe-target";

/** Protect ChatJS-managed outputs before generating integration files. */
export const preflight = async (cwd: string, targets: string[]) => {
  const resolvedCwd = path.resolve(cwd);
  const root = await lstat(resolvedCwd);
  if (!root.isDirectory() || root.isSymbolicLink()) {
    throw new Error("Destination must be a directory, not a symlink.");
  }
  for (const target of targets) {
    if (!isSafeTarget(target, resolvedCwd)) {
      throw new Error(`Unsafe ChatJS target: ${target}`);
    }
    let current = resolvedCwd;
    const parts = target.split("/");
    for (const [index, part] of parts.entries()) {
      current = path.join(current, part);
      const entry = await lstat(current).catch((error) => {
        if (error.code === "ENOENT") {
          return null;
        }
        throw error;
      });
      if (
        entry &&
        (entry.isSymbolicLink() ||
          (index === parts.length - 1 ? !entry.isFile() : !entry.isDirectory()))
      ) {
        throw new Error(`Invalid or symlinked ChatJS target: ${target}`);
      }
    }
  }
};
