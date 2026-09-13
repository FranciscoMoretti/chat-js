import { readdir, lstat } from "node:fs/promises";

import { highlighter } from "../utils/highlighter";
import { logger } from "../utils/logger";

export async function ensureTargetEmpty(targetDir: string): Promise<void> {
  const targetStats = await lstat(targetDir).catch((error) => {
    if (error.code === "ENOENT") return null;
    throw error;
  });
  if (!targetStats) return;
  if (targetStats.isSymbolicLink())
    throw new Error("Target directory must not be a symlink.");

  if (!targetStats.isDirectory()) {
    logger.error(
      `Target exists and is not a directory: ${highlighter.info(targetDir)}`
    );
    process.exit(1);
  }

  const files = await readdir(targetDir);
  if (files.length > 0) {
    logger.error(
      `Target directory is not empty: ${highlighter.info(targetDir)}`
    );
    logger.error("Please choose an empty directory or remove existing files.");
    process.exit(1);
  }
}
