import { readdir, lstat } from "node:fs/promises";

import { highlighter } from "../utils/highlighter";
import { logger } from "../utils/logger";

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
