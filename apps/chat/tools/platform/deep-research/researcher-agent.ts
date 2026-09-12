import { generateText, ToolLoopAgent } from "ai";
import type { ModelMessage } from "ai";

import type { AppModelId, ModelId } from "@/lib/ai/app-models";
import { getLanguageModel } from "@/lib/ai/providers";
import { truncateMessages } from "@/lib/ai/token-utils";

import {
  compressResearchSimpleHumanMessage,
  compressResearchSystemPrompt,
  researchSystemPrompt,
} from "./prompts";
import { createTelemetry } from "./types";
import type { AgentOptions } from "./types";
import { getAllTools, getModelContextWindow, getTodayStr } from "./utils";

const compressResearch = async (
  researchMessages: ModelMessage[],
  options: AgentOptions
): Promise<string> => {
  const { config, abortSignal } = options;
  const model = await getLanguageModel(config.compression_model as ModelId);
  const messages: ModelMessage[] = [
    {
      content: compressResearchSystemPrompt({ date: getTodayStr() }),
      role: "system" as const,
    },
    ...researchMessages,
    { content: compressResearchSimpleHumanMessage, role: "user" as const },
  ];
  const contextWindow = await getModelContextWindow(
    config.compression_model as ModelId
  );
  const truncatedMessages = truncateMessages(messages, contextWindow);
  const response = await generateText({
    maxOutputTokens: config.compression_model_max_tokens,
    messages: truncatedMessages,
    model,
    ...createTelemetry("compressResearch", options),
    abortSignal,
    maxRetries: 3,
  });
  if (response.usage) {
    options.costAccumulator?.addLLMCost(
      config.compression_model as AppModelId,
      response.usage,
      "deep-research-compress"
    );
  }
  return response.text;
};

export const runResearcher = async (
  topic: string,
  options: AgentOptions
): Promise<string> => {
  const { config, dataStream, toolCallId, abortSignal } = options;

  const model = await getLanguageModel(config.research_model as ModelId);
  const tools = await getAllTools(config);

  if (Object.keys(tools).length === 0) {
    throw new Error(
      "No tools found to conduct research: Please configure either your search API or add MCP tools to your configuration."
    );
  }

  dataStream.write({
    data: {
      message: topic,
      status: "running",
      title: "Starting research on topic",
      toolCallId,
      type: "thoughts",
    },
    type: "data-researchUpdate",
  });

  const researcherAgent = new ToolLoopAgent({
    instructions: researchSystemPrompt({
      date: getTodayStr(),
      max_search_queries: config.search_api_max_queries,
      mcp_prompt: config.mcp_prompt || "",
    }),
    maxOutputTokens: config.research_model_max_tokens,
    model,
    prepareStep: () => ({
      toolsContext: Object.fromEntries(
        Object.keys(tools).map((name) => [
          name,
          {
            costAccumulator: options.costAccumulator,
            dataStream,
            toolCallIdOverride: toolCallId,
            writeTopLevelUpdates: false,
          },
        ])
      ),
    }),
    tools,
    ...createTelemetry("researcher", options),
    onStepEnd: ({ usage }) => {
      if (usage) {
        options.costAccumulator?.addLLMCost(
          config.research_model as AppModelId,
          usage,
          "deep-research-researcher"
        );
      }
    },
  });

  const { responseMessages } = await researcherAgent.generate({
    abortSignal,
    prompt: topic,
  });

  const compressed = await compressResearch(responseMessages, options);

  dataStream.write({
    data: {
      message: topic,
      status: "completed",
      title: "Research topic completed",
      toolCallId,
      type: "thoughts",
    },
    type: "data-researchUpdate",
  });

  return compressed;
};
