import { toolDefinition } from "./definition";
import type { ToolUsage } from "@/lib/eve/tool-usage";
import { defineTool } from "eve/tools";
import { executeWithToolUsage } from "@/lib/eve/tool-usage";
import { toolResultToModelOutput } from "@/lib/eve/tool-model-output";
import type { wordCountInput } from "./schemas";
import type { z } from "zod";

const UNBILLED_TOOL_COST_USD = 0;
const EMPTY_COUNT = 0;
const WORD_SPLIT_REGEX = /\s+/u;
const SENTENCE_SPLIT_REGEX = /[.!?]+/u;

export const wordCount = defineTool({
  description: toolDefinition.description,
  execute: async (
    { text }: Readonly<z.infer<typeof wordCountInput>>,
    context: Readonly<{ abortSignal: Readonly<AbortSignal> }>
  ) =>
    await executeWithToolUsage(
      context,
      (usage: Readonly<Pick<ToolUsage, "addCostUsd">>) => {
        usage.addCostUsd(UNBILLED_TOOL_COST_USD);
        const words =
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
  inputSchema: toolDefinition.inputSchema,
  toModelOutput: toolResultToModelOutput,
});
