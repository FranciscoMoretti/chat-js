import type { ToolUsage } from "@/lib/eve/tool-usage";
import { defineTool } from "eve/tools";
import { executeWithToolUsage } from "@/lib/eve/tool-usage";
import { toolResultToModelOutput } from "@/lib/eve/tool-model-output";
import { wordCountInput } from "./schemas";
import type { z } from "zod";

const UNBILLED_TOOL_COST_USD = 0;
const EMPTY_COUNT = 0;
const WORD_SPLIT_REGEX = /\s+/u;
const SENTENCE_SPLIT_REGEX = /[.!?]+/u;

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (wordCount); the enabled import/no-default-export convention rejects the default-export alternative. */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve wordCount's awaited sequencing and rejected-Promise behavior. */
export const wordCount = defineTool({
  description: "Count the words, characters, and sentences in a given text",
  execute: async (
    { text }: Readonly<z.infer<typeof wordCountInput>>,
    context: Readonly<{ abortSignal: Readonly<AbortSignal> }>
  ) =>
    await executeWithToolUsage(
      context,
      (usage: Readonly<Pick<ToolUsage, "addCostUsd">>) => {
        usage.addCostUsd(UNBILLED_TOOL_COST_USD);
        const words =
          // oxlint-disable-next-line no-ternary -- Keep words as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
          text.trim() === ""
            ? EMPTY_COUNT
            : text.trim().split(WORD_SPLIT_REGEX).length;
        const characters = text.length;
        const charactersNoSpaces = text.replaceAll(/\s/gu, "").length;
        const sentences = text
          .split(SENTENCE_SPLIT_REGEX)
          .filter((sentence) => sentence.trim().length > EMPTY_COUNT).length;

        return { characters, charactersNoSpaces, sentences, words };
      }
    ),
  inputSchema: wordCountInput,
  toModelOutput: toolResultToModelOutput,
});
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable oxc/no-async-await */
