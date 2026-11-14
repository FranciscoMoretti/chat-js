import { toolDefinition } from "./definition";
import { defineTool } from "eve/tools";

const WORD_SPLIT_REGEX = /\s+/u;
const SENTENCE_SPLIT_REGEX = /[.!?]+/u;

export const wordCount = defineTool({
  description: toolDefinition.description,
  inputSchema: toolDefinition.inputSchema,
  outputSchema: toolDefinition.outputSchema,
  execute: ({ text }, { abortSignal }) => {
    abortSignal.throwIfAborted();
    return toolDefinition.outputSchema.parse({
      words:
        text.trim() === "" ? 0 : text.trim().split(WORD_SPLIT_REGEX).length,
      characters: text.length,
      charactersNoSpaces: text.replaceAll(/\s/gu, "").length,
      sentences: text
        .split(SENTENCE_SPLIT_REGEX)
        .filter((sentence) => sentence.trim().length > 0).length,
    });
  },
});
