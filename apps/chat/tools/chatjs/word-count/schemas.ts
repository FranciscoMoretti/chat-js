import { z } from "zod";

const wordCountInput = z.object({
  text: z.string().describe("The text to analyze"),
});

const wordCountResult = z.object({
  characters: z.number(),
  charactersNoSpaces: z.number(),
  sentences: z.number(),
  words: z.number(),
});
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (wordCountInput, wordCountResult); the enabled import/no-default-export convention rejects the default-export alternative. */
export { wordCountInput, wordCountResult };
/* oxlint-enable import/no-named-export */
