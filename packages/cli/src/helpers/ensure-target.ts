// oxlint-disable-next-line import/no-nodejs-modules -- The Node/Bun CLI reads, writes, and validates real project files with native filesystem APIs.
import { lstat, readdir } from "node:fs/promises";

import { highlighter } from "#cli/utils/highlighter";
import { logger } from "#cli/utils/logger";

const FAILURE_EXIT_CODE = 1;
const EMPTY_DIRECTORY_SIZE = 0;

const rejectTarget = (messages: readonly string[]): never => {
  for (const message of messages) {
    logger.error(message);
  }
  // oxlint-disable-next-line unicorn/no-process-exit -- Invalid/nonempty CLI targets must exit before the caller proceeds to scaffold writes; setting exitCode would return normally.
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
  if (files.length > EMPTY_DIRECTORY_SIZE) {
    rejectTarget([
      `Target directory is not empty: ${highlighter.info(targetDir)}`,
      "Please choose an empty directory or remove existing files.",
    ]);
  }
};
