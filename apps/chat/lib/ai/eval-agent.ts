import type { LanguageModelUsage } from "ai";

import type { AppModelId } from "@/lib/ai/app-models";
import { createCoreChatAgent } from "@/lib/ai/core-chat-agent";
import { determineExplicitlyRequestedTools } from "@/lib/ai/determine-explicitly-requested-tools";
import { generateFollowupSuggestions } from "@/lib/ai/followup-suggestions";
import { systemPrompt } from "@/lib/ai/prompts";
import type { ChatMessage, StreamWriter, ToolName } from "@/lib/ai/types";
import { CostAccumulator } from "@/lib/credits/cost-accumulator";
import { generateUUID } from "@/lib/utils";

// No-op StreamWriter for evals - tools can write but nothing happens
const createNoOpStreamWriter = (): StreamWriter => ({
  merge: () => {
    // Intentional no-op for evaluation context
  },
  onError: undefined,
  write: () => {
    // Intentional no-op for evaluation context
  },
});

export interface EvalAgentResult {
  assistantMessage: ChatMessage;
  finalText: string;
  followupSuggestions: string[];
  toolResults: {
    toolName: string;
    type: string;
    state?: string;
  }[];
  usage: LanguageModelUsage | undefined;
}
const executeAgentAndGetOutput = async ({
  userMessage,
  previousMessages,
  selectedModelId,
  explicitlyRequestedTools,
  userId,
  abortSignal,
  messageId,
}: {
  userMessage: ChatMessage;
  previousMessages: ChatMessage[];
  selectedModelId: AppModelId;
  explicitlyRequestedTools: ToolName[] | null;
  userId: string | null;
  abortSignal: AbortSignal | undefined;
  messageId: string;
}): Promise<{
  result: Awaited<ReturnType<typeof createCoreChatAgent>>["result"];
  contextForLLM: Awaited<
    ReturnType<typeof createCoreChatAgent>
  >["contextForLLM"];
  output: string;
  responseMessages: Awaited<
    Awaited<
      ReturnType<typeof createCoreChatAgent>
    >["result"]["responseMessages"]
  >;
}> => {
  const noOpStreamWriter = createNoOpStreamWriter();
  const system = systemPrompt();
  const costAccumulator = new CostAccumulator();
  const { result, contextForLLM } = await createCoreChatAgent({
    abortSignal,
    // Discarded for evals
    costAccumulator,
    dataStream: noOpStreamWriter,
    explicitlyRequestedTools,
    messageId,
    onError: (error) => {
      throw error;
    },
    previousMessages,
    selectedModelId,
    system,
    userId,
    userMessage,
  });
  await result.consumeStream();
  const responseMessages = await result.responseMessages;
  const output = await result.output;
  return { contextForLLM, output: output || "", responseMessages, result };
};

const processToolCall = (
  content: {
    toolCallId?: string;
    toolName: string;
    input: unknown;
  },
  parts: ChatMessage["parts"],
  toolResults: {
    toolName: string;
    type: string;
    state?: string;
  }[]
): void => {
  const toolCallId = content.toolCallId || generateUUID();
  const toolPartType = `tool-${content.toolName}` as const;
  parts.push({
    input: content.input,
    state: "input-available",
    toolCallId,
    type: toolPartType,
  } as ChatMessage["parts"][number]);
  toolResults.push({
    state: "input-available",
    toolName: content.toolName,
    type: toolPartType,
  });
};

const updateExistingToolPart = (
  parts: ChatMessage["parts"],
  toolCallId: string | undefined,
  output: unknown
): boolean => {
  const partIndex = parts.findIndex(
    (p) =>
      p.type.startsWith("tool-") &&
      "toolCallId" in p &&
      p.toolCallId === toolCallId
  );
  if (partIndex === -1) {
    return false;
  }
  const part = parts[partIndex];
  if (part.type.startsWith("tool-") && "state" in part) {
    parts[partIndex] = {
      ...part,
      output,
      state: "output-available",
    } as ChatMessage["parts"][number];
  }
  return true;
};

const addToolResultPart = (
  content: {
    toolCallId?: string;
    toolName: string;
    output: unknown;
  },
  parts: ChatMessage["parts"]
): void => {
  const toolPartType = `tool-${content.toolName}` as const;
  parts.push({
    output: content.output,
    state: "output-available",
    toolCallId: content.toolCallId || generateUUID(),
    type: toolPartType,
  } as ChatMessage["parts"][number]);
};

const updateToolResults = (
  toolResults: {
    toolName: string;
    type: string;
    state?: string;
  }[],
  toolName: string
): void => {
  const existingIndex = toolResults.findIndex((tr) => tr.toolName === toolName);
  if (existingIndex === -1) {
    toolResults.push({
      state: "output-available",
      toolName,
      type: `tool-${toolName}`,
    });
    return;
  }
  toolResults[existingIndex] = {
    ...toolResults[existingIndex],
    state: "output-available",
  };
};

const processToolResult = (
  content: {
    toolCallId?: string;
    toolName: string;
    output: unknown;
  },
  parts: ChatMessage["parts"],
  toolResults: {
    toolName: string;
    type: string;
    state?: string;
  }[]
): void => {
  const updated = updateExistingToolPart(
    parts,
    content.toolCallId,
    content.output
  );
  if (!updated) {
    addToolResultPart(content, parts);
  }
  updateToolResults(toolResults, content.toolName);
};

const extractToolCallsAndResults = (
  steps: Awaited<
    Awaited<ReturnType<typeof createCoreChatAgent>>["result"]["steps"]
  >
): {
  parts: ChatMessage["parts"];
  toolResults: {
    toolName: string;
    type: string;
    state?: string;
  }[];
} => {
  const toolResults: {
    toolName: string;
    type: string;
    state?: string;
  }[] = [];
  const parts: ChatMessage["parts"] = [];
  for (const step of steps ?? []) {
    for (const content of step.content) {
      if (content.type === "tool-call") {
        processToolCall(content, parts, toolResults);
      } else if (content.type === "tool-result") {
        processToolResult(content, parts, toolResults);
      }
    }
  }
  return { parts, toolResults };
};

const generateSuggestions = async (
  contextForLLM: Awaited<
    ReturnType<typeof createCoreChatAgent>
  >["contextForLLM"],
  responseMessages: Awaited<
    Awaited<
      ReturnType<typeof createCoreChatAgent>
    >["result"]["responseMessages"]
  >
): Promise<string[]> => {
  const followupSuggestionsResult = generateFollowupSuggestions([
    ...contextForLLM,
    ...responseMessages,
  ]);
  const result = await followupSuggestionsResult;
  let lastSuggestions: string[] = [];
  for await (const chunk of result.partialOutputStream) {
    if (chunk.suggestions) {
      lastSuggestions = chunk.suggestions.filter(
        (s: string | undefined): s is string => s !== undefined
      );
    }
  }
  return lastSuggestions.length > 0 ? lastSuggestions.slice(-5) : [];
};

export const runCoreChatAgentEval = async ({
  userMessage,
  previousMessages = [],
  selectedModelId,
  selectedTool = null,
  userId = null,
  activeTools,
  abortSignal,
}: {
  userMessage: ChatMessage;
  previousMessages?: ChatMessage[];
  selectedModelId: AppModelId;
  selectedTool?: ToolName | null;
  userId?: string | null;
  activeTools: ToolName[];
  abortSignal?: AbortSignal;
}): Promise<EvalAgentResult> => {
  const messageId = generateUUID();
  const requestedTools = determineExplicitlyRequestedTools(selectedTool);
  const explicitlyRequestedTools =
    requestedTools === null
      ? activeTools
      : requestedTools.filter((tool) => activeTools.includes(tool));
  const { result, contextForLLM, output, responseMessages } =
    await executeAgentAndGetOutput({
      abortSignal,
      explicitlyRequestedTools,
      messageId,
      previousMessages,
      selectedModelId,
      userId,
      userMessage,
    });
  const steps = (await result.steps) ?? [];
  const { parts, toolResults } = extractToolCallsAndResults(steps);
  if (output) {
    parts.unshift({
      text: output,
      type: "text",
    });
  }
  const assistantMessage: ChatMessage = {
    id: messageId,
    metadata: {
      activeStreamId: null,
      createdAt: new Date(),
      parentMessageId: userMessage.id,
      selectedModel: selectedModelId,
    },
    parts,
    role: "assistant",
  };
  const followupSuggestions = await generateSuggestions(
    contextForLLM,
    responseMessages
  );
  const usage = await result.usage;
  return {
    assistantMessage,
    finalText: output,
    followupSuggestions,
    toolResults,
    usage,
  };
};
