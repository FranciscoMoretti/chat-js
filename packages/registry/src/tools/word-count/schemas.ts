import { z } from "zod";

/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
export const wordCountInput = z.object({
  text: z.string().describe("The text to analyze"),
});
/* oxlint-enable import/group-exports */

/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
export const wordCountResult = z.object({
  characters: z.number(),
  charactersNoSpaces: z.number(),
  sentences: z.number(),
  words: z.number(),
});
/* oxlint-enable import/group-exports */
