import { z } from "zod";

import { highlighter } from "./highlighter";

import { logger } from "./logger";

const failureExitCode = 1;

export const handleError: (error: unknown) => never = (error) => {
  logger.break();

  if (typeof error === "string") {
    logger.error(error);
  } else if (error instanceof z.ZodError) {
    logger.error("Validation failed:");
    for (const issue of error.issues) {
      const path = z.core.toDotPath(issue.path);
      const prefix = path ? `${highlighter.info(path)}: ` : "";
      logger.error(`- ${prefix}${issue.message}`);
    }
  } else if (error instanceof Error) {
    logger.error(error.message);
  } else {
    logger.error("An unknown error occurred.");
  }

  logger.break();
  process.exit(failureExitCode);
};
