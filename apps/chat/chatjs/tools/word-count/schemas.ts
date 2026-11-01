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
export { wordCountInput, wordCountResult };
