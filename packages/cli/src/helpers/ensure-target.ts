import { lstat, readdir } from "node:fs/promises";
import { highlighter } from "#cli/utils/highlighter";
import { logger } from "#cli/utils/logger";

const FAILURE_EXIT_CODE = 1;
const EMPTY_DIRECTORY_ENTRY_COUNT = 0;

const rejectTarget = (messages: readonly string[]): never => {
  for (const message of messages) {
    logger.error(message);
  }
  process.exit(FAILURE_EXIT_CODE);
};

export const ensureTargetEmpty = async (targetDir: string): Promise<void> => {
  const targetStats = await lstat(targetDir).catch((error: unknown) => {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return;
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
    rejectTarget([
      `Target exists and is not a directory: ${highlighter.info(targetDir)}`,
    ]);
  }

  const files = await readdir(targetDir);
  if (files.length > EMPTY_DIRECTORY_ENTRY_COUNT) {
    rejectTarget([
      `Target directory is not empty: ${highlighter.info(targetDir)}`,
      "Please choose an empty directory or remove existing files.",
    ]);
  }
};
