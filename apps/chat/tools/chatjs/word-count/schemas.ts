import { z } from "zod";

export const wordCountInput = z.object({
  text: z.string().describe("The text to analyze"),
});

export const wordCountResult = z.object({
  characters: z.number(),
  charactersNoSpaces: z.number(),
  sentences: z.number(),
  words: z.number(),
});
