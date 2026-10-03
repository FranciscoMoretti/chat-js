/* oxlint-disable import/no-nodejs-modules -- This code runs on the Node/Bun server or installer and requires the built-in operating-system API. */
import { lstat } from "node:fs/promises";
/* oxlint-enable import/no-nodejs-modules */
/* oxlint-disable import/no-nodejs-modules -- This code runs on the Node/Bun server or installer and requires the built-in operating-system API. */
import path from "node:path";
/* oxlint-enable import/no-nodejs-modules */

import { isSafeTarget } from "./is-safe-target";

/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable jsdoc/require-param -- This comment documents the API invariant; parameter names and TypeScript annotations describe the inputs without duplicating them in tags. */
/* oxlint-disable unicorn/no-null -- Null is an explicit SDK, serialized-data, or React absence sentinel; replacing it would change the contract. */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
/** Protect ChatJS-managed outputs before generating integration files. */
export const preflight = async (
  cwd: string,
  targets: readonly string[]
): Promise<void> => {
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
      // oxlint-disable-next-line no-await-in-loop -- Validate each parent before traversing its child; never follow an unchecked symlink.
      const entry = await lstat(current).catch((error: unknown) => {
        if (
          error instanceof Error &&
          "code" in error &&
          error.code === "ENOENT"
        ) {
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
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable unicorn/no-null */
/* oxlint-enable jsdoc/require-param */
/* oxlint-enable eslint/max-statements */
