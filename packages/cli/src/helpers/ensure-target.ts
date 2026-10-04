import { readdir, lstat } from "node:fs/promises";

/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { highlighter } from "../utils/highlighter";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { logger } from "../utils/logger";
/* oxlint-enable import/no-relative-parent-imports */

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
