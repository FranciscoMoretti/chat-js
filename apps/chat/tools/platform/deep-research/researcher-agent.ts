import { generateText, ToolLoopAgent } from "ai";
import type { ModelMessage } from "ai";

import type { AppModelId, ModelId } from "@/lib/ai/app-models";
import { truncateMessages } from "@/lib/ai/token-utils";

import {
  compressResearchSimpleHumanMessage,
  compressResearchSystemPrompt,
  researchSystemPrompt,
} from "./prompts";
import { createTelemetry } from "./types";
import type { AgentOptions } from "./types";
import { getTodayStr, withResearchTools } from "./utils";

/* eslint-disable func-style, sort-keys -- Keep the upstream research pipeline structure readable. */
export async function runResearcher(
  topic: string,
  options: AgentOptions
): Promise<string> {
  const { config, dataStream, toolCallId, abortSignal } = options;

  const model = await options.getLanguageModel(
    config.research_model as ModelId
  );
  return withResearchTools(config, async (tools) => {
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
      model,
      instructions: researchSystemPrompt({
        date: getTodayStr(),
        max_search_queries: config.search_api_max_queries,
        mcp_prompt: config.mcp_prompt || "",
      }),
      tools,
      maxOutputTokens: config.research_model_max_tokens,
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

    // eslint-disable-next-line no-use-before-define -- Compression is the second phase of this pipeline.
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
  });
}

async function compressResearch(
  researchMessages: ModelMessage[],
  options: AgentOptions
): Promise<string> {
  const { config, abortSignal } = options;
  const model = await options.getLanguageModel(
    config.compression_model as ModelId
  );

  const messages: ModelMessage[] = [
    {
      content: compressResearchSystemPrompt({ date: getTodayStr() }),
      role: "system" as const,
    },
    ...researchMessages,
    {
      content: compressResearchSimpleHumanMessage,
      role: "user" as const,
    },
  ];

  const contextWindow = await options.getModelContextWindow(
    config.compression_model as ModelId
  );
  const truncatedMessages = truncateMessages(messages, contextWindow);

  const response = await generateText({
    model,
    messages: truncatedMessages,
    maxOutputTokens: config.compression_model_max_tokens,
    ...createTelemetry("compressResearch", options),
    maxRetries: 3,
    abortSignal,
  });

  if (response.usage) {
    options.costAccumulator?.addLLMCost(
      config.compression_model as AppModelId,
      response.usage,
      "deep-research-compress"
    );
  }

  return response.text;
}
