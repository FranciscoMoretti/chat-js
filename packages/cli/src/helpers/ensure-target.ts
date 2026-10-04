import { readdir, lstat } from "node:fs/promises";

/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { highlighter } from "../utils/highlighter";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { logger } from "../utils/logger";
/* oxlint-enable import/no-relative-parent-imports */

/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable unicorn/no-null -- Null is an explicit SDK, serialized-data, or React absence sentinel; replacing it would change the contract. */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
export const ensureTargetEmpty = async (targetDir: string): Promise<void> => {
  const targetStats = await lstat(targetDir).catch((error: unknown) => {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return null;
    }
    throw error;
  });
  if (!targetStats) {
    return;
  }
  if (targetStats.isSymbolicLink()) {
    throw new Error("Target directory must not be a symlink.");
  }

  if (!targetStats.isDirectory()) {
    logger.error(
      `Target exists and is not a directory: ${highlighter.info(targetDir)}`
    );
    // oxlint-disable-next-line unicorn/no-process-exit -- #571: Abort CLI generation before any writes when the target is invalid or already populated.
    process.exit(1);
  }

  const files = await readdir(targetDir);
  if (files.length > 0) {
    logger.error(
      `Target directory is not empty: ${highlighter.info(targetDir)}`
    );
    logger.error("Please choose an empty directory or remove existing files.");
    // oxlint-disable-next-line unicorn/no-process-exit -- #571: Abort CLI generation before any writes when the target is invalid or already populated.
    process.exit(1);
  }
};
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable unicorn/no-null */
/* oxlint-enable eslint/max-statements */
