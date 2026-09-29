/* oxlint-disable eslint/func-style -- EVE compiles top-level async workflow and step declarations. */
/* oxlint-disable eslint/no-await-in-loop -- Adaptive rounds and research topics intentionally run in order. */
import type { WorkflowToolContext } from "eve/tools";
import { z } from "zod";

import {
  clarifyWithUserInstructions,
  compressResearchSimpleHumanMessage,
  compressResearchSystemPrompt,
  finalReportGenerationPrompt,
  leadResearcherPrompt,
  researchSystemPrompt,
  transformMessagesIntoResearchTopicPrompt,
} from "../../tools/platform/deep-research/prompts";
import type { ResearchUpdate } from "../../tools/platform/research-updates-schema";
import type { eveDocumentWriteResult } from "./document-contracts";
import {
  researchBrief,
  researchClarification,
  researchDecision,
  researchFindings,
  researchReport,
} from "./research-contracts";
import {
  prepareResearch,
  researchCompletionTime,
  saveResearchReport,
} from "./research-steps";
import { createToolResult } from "./tool-result";
import type { ToolResult } from "./tool-result";

type ResearchOutput =
  | { searches: [] }
  | { answer: string; format: "clarifying_questions" }
  | (z.infer<typeof eveDocumentWriteResult> & { format: "report" });

const outputSchema = (schema: z.ZodType) =>
  z.record(z.string(), z.json()).parse(z.toJSONSchema(schema));

export async function* executeEveResearch(
  _input: Record<string, never>,
  context: WorkflowToolContext
): AsyncGenerator<ToolResult<ResearchOutput>, void> {
  "use workflow";
  const { config, date, messages, timestamp } = await prepareResearch(context);
  const updates: ResearchUpdate[] = [];
  // Native child events own model/search costs. This orchestration receipt adds no charge.
  const progress = () =>
    createToolResult<ResearchOutput>({ searches: [] }, 0, [...updates]);
  if (config.allow_clarification) {
    const clarification = researchClarification.parse(
      await context.agent("researchPlanner", {
        message: clarifyWithUserInstructions({ date, messages }),
        outputSchema: outputSchema(researchClarification),
      })
    );
    if (clarification.need_clarification) {
      yield createToolResult(
        { answer: clarification.question, format: "clarifying_questions" },
        0
      );
      return;
    }
  }
  updates.push(
    {
      timestamp,
      title: "Starting research",
      toolCallId: context.callId,
      type: "started",
    },
    {
      status: "running",
      title: "Writing research brief",
      toolCallId: context.callId,
      type: "writing",
    }
  );
  yield progress();
  const brief = researchBrief.parse(
    await context.agent("researchPlanner", {
      message: transformMessagesIntoResearchTopicPrompt({ date, messages }),
      outputSchema: outputSchema(researchBrief),
    })
  );
  updates[1] = {
    message: brief.research_brief,
    status: "completed",
    title: "Writing research brief",
    toolCallId: context.callId,
    type: "writing",
  };
  yield progress();

  const notes: { topic: string; findings: string }[] = [];
  const decisionSchema = researchDecision.extend({
    topics: researchDecision.shape.topics.max(
      config.max_concurrent_research_units
    ),
  });
  // Preserve the SDK's max_researcher_iterations + 1 decision steps, including
  // its allowance for research on the final step if the supervisor has not finished.
  for (let round = 0; round <= config.max_researcher_iterations; round += 1) {
    context.abortSignal.throwIfAborted();
    const decision = decisionSchema.parse(
      await context.agent("researchPlanner", {
        message: `${leadResearcherPrompt({ date, max_concurrent_research_units: config.max_concurrent_research_units })}\n\nResearch brief: ${brief.research_brief}\n\nFindings so far:\n${JSON.stringify(notes)}\n\nDecision round ${round + 1} of ${config.max_researcher_iterations + 1}. Return your next decision as JSON.`,
        outputSchema: outputSchema(decisionSchema),
      })
    );
    if (decision.complete) {
      break;
    }
    if (decision.topics.length === 0) {
      throw new Error("The research supervisor must select topics or finish.");
    }
    for (const topic of decision.topics) {
      context.abortSignal.throwIfAborted();
      const updateIndex = updates.length;
      updates.push({
        message: topic,
        status: "running",
        title: "Researching topic",
        toolCallId: context.callId,
        type: "thoughts",
      });
      yield progress();
      const raw = researchFindings.parse(
        await context.agent("researcher", {
          message: `${researchSystemPrompt({ date, max_search_queries: config.search_api_max_queries, mcp_prompt: "" })}\n\nTopic:\n${topic}\n\nReturn comprehensive raw findings, preserving source URLs, citations, relevant quotations, uncertainties, and conflicting evidence for the compression stage.`,
          outputSchema: outputSchema(researchFindings),
        })
      );
      const compressed = researchFindings.parse(
        await context.agent("researchCompressor", {
          message: `${compressResearchSystemPrompt({ date })}\n\n${raw.findings}\n\n${compressResearchSimpleHumanMessage}`,
          outputSchema: outputSchema(researchFindings),
        })
      );
      notes.push({ findings: compressed.findings, topic });
      updates[updateIndex] = {
        message: topic,
        status: "completed",
        title: "Research topic completed",
        toolCallId: context.callId,
        type: "thoughts",
      };
      yield progress();
    }
  }
  const reportUpdateIndex = updates.length;
  updates.push({
    status: "running",
    title: "Writing final report",
    toolCallId: context.callId,
    type: "writing",
  });
  yield progress();
  const report = researchReport.parse(
    await context.agent("researchWriter", {
      message: `${finalReportGenerationPrompt({ date, findings: notes.map((note) => note.findings).join("\n"), research_brief: brief.research_brief })}\n\nWrite the complete Markdown report with title ${JSON.stringify(brief.title)}. Return title and content; the workflow will save the document.`,
      outputSchema: outputSchema(researchReport),
    })
  );
  context.abortSignal.throwIfAborted();
  const saved = await saveResearchReport(context, report);
  updates[reportUpdateIndex] = {
    status: "completed",
    title: "Writing final report",
    toolCallId: context.callId,
    type: "writing",
  };
  updates.push({
    timestamp: await researchCompletionTime(),
    title: "Research complete",
    toolCallId: context.callId,
    type: "completed",
  });
  yield createToolResult({ ...saved, format: "report" }, 0, updates);
}
