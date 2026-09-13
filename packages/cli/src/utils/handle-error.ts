import { z } from "zod";

import { highlighter } from "./highlighter";
import { logger } from "./logger";

export function handleError(error: unknown): never {
  logger.break();

  if (typeof error === "string") {
    logger.error(error);
    logger.break();
    process.exit(1);
  }

  if (error instanceof z.ZodError) {
    logger.error("Validation failed:");
    for (const [key, value] of Object.entries(error.flatten().fieldErrors)) {
      logger.error(`- ${highlighter.info(key)}: ${value}`);
    }
    logger.break();
    process.exit(1);
  }

  if (error instanceof Error) {
    logger.error(error.message);
    logger.break();
    process.exit(1);
  }

  logger.error("An unknown error occurred.");
  logger.break();
  process.exit(1);
}
