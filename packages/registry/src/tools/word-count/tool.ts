import { tool } from "ai";
import { z } from "zod";

const WORD_SPLIT_REGEX = /\s+/u;
const SENTENCE_SPLIT_REGEX = /[.!?]+/u;

export const wordCount = tool({
  description: "Count the words, characters, and sentences in a given text",
  execute: ({ text }: { text: string }) => {
    const words =
      text.trim() === "" ? 0 : text.trim().split(WORD_SPLIT_REGEX).length;
    const characters = text.length;
    const charactersNoSpaces = text.replaceAll(/\s/gu, "").length;
    const sentences = text
      .split(SENTENCE_SPLIT_REGEX)
      .filter((s) => s.trim().length > 0).length;

    return { characters, charactersNoSpaces, sentences, words };
  },
  inputSchema: z.object({
    text: z.string().describe("The text to analyze"),
  }),
});

export interface WordCountOutput {
  words: number;
  characters: number;
  charactersNoSpaces: number;
  sentences: number;
}
