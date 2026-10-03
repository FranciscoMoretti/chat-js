import { z } from "zod";

/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import { highlighter } from "./highlighter";
/* oxlint-enable eslint/sort-imports */
import { logger } from "./logger";

/* oxlint-disable import/prefer-default-export -- Keep the named import contract used by registry consumers and package callers even when this module exposes one value. */
/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
export const handleError: (error: unknown) => never = (error) => {
  logger.break();

  if (typeof error === "string") {
    logger.error(error);
    logger.break();
    // oxlint-disable-next-line unicorn/no-process-exit -- #571: This terminal CLI error handler must not return and continue the failed command.
    process.exit(1);
  }

  if (error instanceof z.ZodError) {
    logger.error("Validation failed:");
    for (const [key, value] of Object.entries(
      z.flattenError(error).fieldErrors
    )) {
      logger.error(`- ${highlighter.info(key)}: ${String(value)}`);
    }
    logger.break();
    // oxlint-disable-next-line unicorn/no-process-exit -- #571: This terminal CLI error handler must not return and continue the failed command.
    process.exit(1);
  }

  if (error instanceof Error) {
    logger.error(error.message);
    logger.break();
    // oxlint-disable-next-line unicorn/no-process-exit -- #571: This terminal CLI error handler must not return and continue the failed command.
    process.exit(1);
  }

  logger.error("An unknown error occurred.");
  logger.break();
  // oxlint-disable-next-line unicorn/no-process-exit -- #571: This terminal CLI error handler must not return and continue the failed command.
  process.exit(1);
};
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable import/no-named-export */
/* oxlint-enable eslint/max-statements */
/* oxlint-enable import/prefer-default-export */
