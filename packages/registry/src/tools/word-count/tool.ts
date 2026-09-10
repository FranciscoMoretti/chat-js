import { tool } from "ai";
import { z } from "zod";

const WORD_SPLIT_REGEX = /\s+/;
const SENTENCE_SPLIT_REGEX = /[.!?]+/;

export const wordCount = tool({
  description: "Count the words, characters, and sentences in a given text",
  inputSchema: z.object({
    text: z.string().describe("The text to analyze"),
  }),
  execute: ({ text }: { text: string }) => {
    const words =
      text.trim() === "" ? 0 : text.trim().split(WORD_SPLIT_REGEX).length;
    const characters = text.length;
    const charactersNoSpaces = text.replace(/\s/g, "").length;
    const sentences = text
      .split(SENTENCE_SPLIT_REGEX)
      .filter((s) => s.trim().length > 0).length;

    return { words, characters, charactersNoSpaces, sentences };
  },
});

export type WordCountOutput = {
  words: number;
  characters: number;
  charactersNoSpaces: number;
  sentences: number;
};
