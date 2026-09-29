import { defineTool } from "eve/tools";

import { toolResultToModelOutput } from "@/lib/eve/tool-model-output";
import { executeWithToolUsage } from "@/lib/eve/tool-usage";

import { wordCountInput } from "./schemas";

const WORD_SPLIT_REGEX = /\s+/u;
const SENTENCE_SPLIT_REGEX = /[.!?]+/u;

export const wordCount = defineTool({
  description: "Count the words, characters, and sentences in a given text",
  execute: ({ text }, context) =>
    executeWithToolUsage(context, (usage) => {
      usage.addCostUsd(0);
      const words =
        text.trim() === "" ? 0 : text.trim().split(WORD_SPLIT_REGEX).length;
      const characters = text.length;
      const charactersNoSpaces = text.replaceAll(/\s/gu, "").length;
      const sentences = text
        .split(SENTENCE_SPLIT_REGEX)
        .filter((s) => s.trim().length > 0).length;

      return { characters, charactersNoSpaces, sentences, words };
    }),
  inputSchema: wordCountInput,
  toModelOutput: toolResultToModelOutput,
});
