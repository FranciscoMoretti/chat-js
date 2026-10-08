import { z } from "zod";

// oxlint-disable-next-line sort-imports -- Preserve zod before ./highlighter while their runtime initialization order is still under site review.
import { highlighter } from "./highlighter";

import { logger } from "./logger";

const failureExitCode = 1;

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (handleError); the enabled import/no-default-export convention rejects the default-export alternative. */
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
/* oxlint-enable import/prefer-default-export, import/no-named-export */
