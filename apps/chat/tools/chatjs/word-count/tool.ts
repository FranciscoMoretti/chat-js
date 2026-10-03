import { defineTool } from "eve/tools";

import { toolResultToModelOutput } from "@/lib/eve/tool-model-output";
import { executeWithToolUsage } from "@/lib/eve/tool-usage";

import { wordCountInput } from "./schemas";

const WORD_SPLIT_REGEX = /\s+/u;
const SENTENCE_SPLIT_REGEX = /[.!?]+/u;

/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
/* oxlint-disable eslint/id-length -- Short callback indices and coordinate keys match the surrounding collection or external data shape; renaming public keys would change the contract. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
/* oxlint-disable typescript/promise-function-async -- Return the existing promise directly to preserve its identity and the current synchronous-throw boundary. */
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
/* oxlint-enable typescript/promise-function-async */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/id-length */
/* oxlint-enable eslint/no-magic-numbers */
