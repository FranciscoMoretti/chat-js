import { z } from "zod";

import { highlighter } from "./highlighter";
import { logger } from "./logger";

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
