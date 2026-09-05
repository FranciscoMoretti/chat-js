import { hasToolCall, isStepCount, ToolLoopAgent, tool } from "ai";
import { z } from "zod";
import type { AppModelId, ModelId } from "@/lib/ai/app-models";
import { getLanguageModel } from "@/lib/ai/providers";
import { leadResearcherPrompt } from "./prompts";
import { runResearcher } from "./researcher-agent";
import { type AgentOptions, createTelemetry } from "./types";
import { getTodayStr } from "./utils";

export async function runSupervisor(
  researchBrief: string,
  options: AgentOptions
): Promise<string[]> {
  const { config, dataStream, toolCallId, abortSignal } = options;
  const model = await getLanguageModel(config.research_model as ModelId);

  // Sequential execution queue to avoid streaming race conditions and rate limits
  let researchQueue = Promise.resolve<unknown>(undefined);

  const conductResearchTool = tool({
    description: "Call this tool to conduct research on a specific topic.",
    inputSchema: z.object({
      research_topic: z
        .string()
        .describe(
          "The topic to research. Should be a single topic, and should be described in high detail (at least a paragraph)."
        ),
    }),
    execute: ({ research_topic }) => {
      researchQueue = researchQueue.then(() =>
        runResearcher(research_topic, options)
      );
      return researchQueue as Promise<string>;
    },
  });

  const researchCompleteTool = tool({
    description: "Call this tool to indicate that the research is complete.",
    inputSchema: z.object({}),
    execute: async () => "Research marked as complete.",
  });

  // max_researcher_iterations + 1 to account for the final researchComplete step
  const maxSteps = config.max_researcher_iterations + 1;

  const supervisorAgent = new ToolLoopAgent({
    model,
    instructions: leadResearcherPrompt({
      date: getTodayStr(),
      max_concurrent_research_units: config.max_concurrent_research_units,
    }),
    tools: {
      conductResearch: conductResearchTool,
      researchComplete: researchCompleteTool,
    },
    maxOutputTokens: config.research_model_max_tokens,
    stopWhen: [hasToolCall("researchComplete"), isStepCount(maxSteps)],
    ...createTelemetry("supervisor", options),
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
          type: "data-researchUpdate",
          data: {
            toolCallId,
            title: "Research tasks completed",
            message: `Researched: ${topicsResearched.join(", ")}`,
            type: "thoughts",
            status: "completed",
          },
        });
      }
    },
  });

  const { steps } = await supervisorAgent.generate({
    prompt: researchBrief,
    abortSignal,
  });

  return steps.flatMap((step) =>
    step.toolResults
      .filter((tr) => tr.toolName === "conductResearch")
      .map((tr) => String(tr.output))
  );
}
