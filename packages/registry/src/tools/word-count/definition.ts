import type { ToolDefinition } from "@/chatjs/core/tools/tool-definition";
import { wordCountInput, wordCountResult } from "./schemas";

export const toolDefinition = {
  name: "wordCount",
  description: "Count the words, characters, and sentences in a given text",
  inputSchema: wordCountInput,
  outputSchema: wordCountResult,
  display: { name: "Word count", shortName: "Word count" },
} as const satisfies ToolDefinition;
