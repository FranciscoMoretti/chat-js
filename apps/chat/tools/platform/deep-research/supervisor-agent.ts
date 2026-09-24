import { hasToolCall, isStepCount, ToolLoopAgent, tool } from "ai";
import { z } from "zod";

import type { AppModelId, ModelId } from "@/lib/ai/app-models";

import { leadResearcherPrompt } from "./prompts";
import { runResearcher } from "./researcher-agent";
import { createTelemetry } from "./types";
import type { AgentOptions } from "./types";
import { getTodayStr } from "./utils";

export const runSupervisor = async (
  researchBrief: string,
  options: AgentOptions
): Promise<string[]> => {
  const { abortSignal, config, dataStream, toolCallId } = options;
  const model = await options.getLanguageModel(
    config.research_model as ModelId
  );

  // Sequential execution queue to avoid streaming race conditions and rate limits
  let researchQueue: Promise<unknown> = Promise.resolve();

  const conductResearchTool = tool({
    description: "Call this tool to conduct research on a specific topic.",
    execute: ({ research_topic }) => {
      const previousResearch = researchQueue;
      const currentResearch = (async () => {
        await previousResearch;
        return runResearcher(research_topic, options);
      })();
      researchQueue = currentResearch;
      return currentResearch;
    },
    inputSchema: z.object({
      research_topic: z
        .string()
        .describe(
          "The topic to research. Should be a single topic, and should be described in high detail (at least a paragraph)."
        ),
    }),
  });

  const researchCompleteTool = tool({
    description: "Call this tool to indicate that the research is complete.",
    execute: () => "Research marked as complete.",
    inputSchema: z.object({}),
  });

  // max_researcher_iterations + 1 to account for the final researchComplete step
  const maxSteps = config.max_researcher_iterations + 1;

  const supervisorAgent = new ToolLoopAgent({
    ...createTelemetry("supervisor", options),
    instructions: leadResearcherPrompt({
      date: getTodayStr(),
      max_concurrent_research_units: config.max_concurrent_research_units,
    }),
    maxOutputTokens: config.research_model_max_tokens,
    model,
    onStepEnd: ({ usage, toolCalls }) => {
      if (usage) {
        options.costAccumulator?.addLLMCost(
          config.research_model as AppModelId,
          usage,
          "deep-research-supervisor"
        );
      }

      const topicsResearched = toolCalls
        .filter((tc) => tc.toolName === "conductResearch")
        .map(
          (tc) =>
            (tc as { input: { research_topic: string } }).input.research_topic
        );

      if (topicsResearched.length > 0) {
        dataStream.write({
          data: {
            message: `Researched: ${topicsResearched.join(", ")}`,
            status: "completed",
            title: "Research tasks completed",
            toolCallId,
            type: "thoughts",
          },
          type: "data-researchUpdate",
        });
      }
    },
    stopWhen: [hasToolCall("researchComplete"), isStepCount(maxSteps)],
    tools: {
      conductResearch: conductResearchTool,
      researchComplete: researchCompleteTool,
    },
  });

  const { steps } = await supervisorAgent.generate({
    abortSignal,
    prompt: researchBrief,
  });

  return steps.flatMap((step) =>
    step.toolResults
      .filter((tr) => tr.toolName === "conductResearch")
      .map((tr) => String(tr.output))
  );
};
