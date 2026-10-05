import { z } from "zod";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { highlighter } from "./highlighter";
/* oxlint-enable sort-imports */
import { logger } from "./logger";

const failureExitCode = 1;

export const handleError: (error: unknown) => never = (error) => {
  logger.break();

  if (typeof error === "string") {
    logger.error(error);
  } else if (error instanceof z.ZodError) {
    logger.error("Validation failed:");
    for (const [key, value] of Object.entries(
      z.flattenError(error).fieldErrors
    )) {
      logger.error(`- ${highlighter.info(key)}: ${String(value)}`);
    }
  } else if (error instanceof Error) {
    logger.error(error.message);
  } else {
    logger.error("An unknown error occurred.");
  }

  logger.break();
  // oxlint-disable-next-line unicorn/no-process-exit -- The CLI commands call this never-returning handler after failure; setting exitCode would return and permit subsequent command writes.
  process.exit(failureExitCode);
};
