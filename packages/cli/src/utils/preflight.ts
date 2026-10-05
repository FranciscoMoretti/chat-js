// oxlint-disable-next-line import/no-nodejs-modules -- The Node/Bun CLI reads, writes, and validates real project files with native filesystem APIs.
import { lstat } from "node:fs/promises";
// oxlint-disable-next-line import/no-nodejs-modules -- The Node/Bun CLI resolves platform-specific project and installation paths.
import path from "node:path";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { isSafeTarget } from "./is-safe-target";
/* oxlint-enable sort-imports */

const LAST_PART_OFFSET = 1;

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve managedRootDirectory's awaited sequencing and rejected-Promise behavior. */
const managedRootDirectory = async (cwd: string): Promise<string> => {
  const resolvedCwd = path.resolve(cwd);
  const root = await lstat(resolvedCwd);
  if (!root.isDirectory() || root.isSymbolicLink()) {
    throw new Error("Destination must be a directory, not a symlink.");
  }
  return resolvedCwd;
};
/* oxlint-enable oxc/no-async-await */
const assertSafeTarget = (target: string, resolvedCwd: string): void => {
  if (!isSafeTarget(target, resolvedCwd)) {
    throw new Error(`Unsafe ChatJS target: ${target}`);
  }
};

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (preflight); the enabled import/no-default-export convention rejects the default-export alternative. */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve preflight's awaited sequencing and rejected-Promise behavior. */
/**
 * Protect ChatJS-managed outputs before generating integration files.
 * @param {string} cwd Project destination, resolved relative to the current directory.
 * @param {readonly string[]} targets Managed file paths whose existing parents and leaf must be safe.
 */
export const preflight = async (
  cwd: string,
  targets: readonly string[]
): Promise<void> => {
  const resolvedCwd = await managedRootDirectory(cwd);
  for (const target of targets) {
    assertSafeTarget(target, resolvedCwd);
    let current = resolvedCwd;
    const parts = target.split("/");
    for (const [index, part] of parts.entries()) {
      current = path.join(current, part);
      // oxlint-disable-next-line no-await-in-loop -- Validate each parent before traversing its child; never follow an unchecked symlink.
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
          (index === parts.length - LAST_PART_OFFSET
            ? !entry.isFile()
            : !entry.isDirectory()))
      ) {
        throw new Error(`Invalid or symlinked ChatJS target: ${target}`);
      }
    }
  }
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable oxc/no-async-await */
