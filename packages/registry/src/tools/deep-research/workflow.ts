import {
  clarifyWithUserInstructions,
  compressResearchSimpleHumanMessage,
  compressResearchSystemPrompt,
  finalReportGenerationPrompt,
  leadResearcherPrompt,
  researchSystemPrompt,
  transformMessagesIntoResearchTopicPrompt,
} from "./prompts";
import {
  prepareResearch,
  researchCompletionTime,
  saveResearchReport,
} from "./steps";
import {
  researchBrief,
  researchClarification,
  researchDecision,
  researchFindings,
  researchReport,
} from "./schemas";
import type { ResearchUpdate } from "@/tools/platform/research-updates-schema";
import type { ToolResult } from "@/lib/eve/tool-result";
import type { WorkflowToolContext } from "eve/tools";
import { createToolResult } from "@/lib/eve/tool-result";
import type { researchOutput } from "./schemas";
import { researchSearchUpdates } from "./search-updates";
import { z } from "zod";

type ResearchOutput = z.infer<typeof researchOutput>;

type ResearchWorkflowContext = Readonly<
  Omit<WorkflowToolContext, "abortSignal"> & {
    abortSignal: Readonly<AbortSignal>;
  }
>;

const structuredMessage = (message: string): string =>
  `${message}\n\nDeliver the requested fields through the final_output tool. Put any Markdown inside its string fields; do not return prose or JSON text instead of calling the tool.`;

const outputSchema = (schema: z.ZodType): Record<string, z.JSONType> =>
  z.record(z.string(), z.json()).parse(z.toJSONSchema(schema));

const ORCHESTRATION_COST_USD = 0;
const INITIAL_RESEARCH_ROUND = 0;
const RESEARCH_ROUND_INCREMENT = 1;
const BRIEF_UPDATE_INDEX = 1;
const EMPTY_TOPIC_COUNT = 0;
// oxlint-disable-next-line eslint/func-style -- EVE's directive compiler discovers this durable workflow only as a top-level async function declaration.
export async function* executeEveResearch(
  _input: Readonly<Record<string, never>>,
  context: ResearchWorkflowContext
): AsyncGenerator<ToolResult<ResearchOutput>, void> {
  "use workflow";
  const { config, date, messages, timestamp } = await prepareResearch(context);
  const updates: ResearchUpdate[] = [];
  let searchUpdates: ResearchUpdate[] = [];
  // Native child events own model/search costs. This orchestration receipt adds no charge.
  const progress = (): ToolResult<ResearchOutput> =>
    createToolResult<ResearchOutput>({ searches: [] }, ORCHESTRATION_COST_USD, [
      ...updates,
      ...searchUpdates,
    ]);
  if (config.allow_clarification) {
    const clarification = researchClarification.parse(
      await context.agent("researchPlanner", {
        message: structuredMessage(
          clarifyWithUserInstructions({ date, messages })
        ),
        outputSchema: outputSchema(researchClarification),
      })
    );
    if (clarification.need_clarification) {
      yield createToolResult(
        { answer: clarification.question, format: "clarifying_questions" },
        ORCHESTRATION_COST_USD
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
      message: structuredMessage(
        transformMessagesIntoResearchTopicPrompt({ date, messages })
      ),
      outputSchema: outputSchema(researchBrief),
    })
  );
  updates[BRIEF_UPDATE_INDEX] = {
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
  for (
    let round = INITIAL_RESEARCH_ROUND;
    round <= config.max_researcher_iterations;
    round += RESEARCH_ROUND_INCREMENT
  ) {
    context.abortSignal.throwIfAborted();
    const decision = decisionSchema.parse(
      // oxlint-disable-next-line no-await-in-loop -- Each decision consumes the findings added by the preceding round.
      await context.agent("researchPlanner", {
        message: structuredMessage(
          `${leadResearcherPrompt({ date, max_concurrent_research_units: config.max_concurrent_research_units })}\n\nResearch brief: ${brief.research_brief}\n\nFindings so far:\n${JSON.stringify(notes)}\n\nDecision round ${round + RESEARCH_ROUND_INCREMENT} of ${config.max_researcher_iterations + RESEARCH_ROUND_INCREMENT}. Return your next decision.`
        ),
        outputSchema: outputSchema(decisionSchema),
      })
    );
    if (decision.complete) {
      break;
    }
    if (decision.topics.length === EMPTY_TOPIC_COUNT) {
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
      let raw: z.infer<typeof researchFindings>;
      try {
        raw = researchFindings.parse(
          // oxlint-disable-next-line no-await-in-loop -- Publish each topic's progress and finish its child before advancing; failure must prevent later topics from starting.
          await context.agent("researcher", {
            message: structuredMessage(
              `${researchSystemPrompt({ date, max_search_queries: config.search_api_max_queries, mcp_prompt: "" })}\n\nTopic:\n${topic}\n\nReturn comprehensive raw findings, preserving source URLs, citations, relevant quotations, uncertainties, and conflicting evidence for the compression stage.`
            ),
            outputSchema: outputSchema(researchFindings),
          })
        );
      } catch (error) {
        // Keep completed search evidence even if the researcher later fails.
        // Cancellation must stop promptly instead of starting more reads.
        context.abortSignal.throwIfAborted();
        const previousSearchUpdates = searchUpdates;
        // oxlint-disable-next-line no-await-in-loop -- Preserve completed search evidence before publishing the failure and terminating the topic loop.
        searchUpdates = await researchSearchUpdates(context).catch(
          () => previousSearchUpdates
        );
        yield progress();
        throw error;
      }
      // oxlint-disable-next-line no-await-in-loop -- Read the just-completed child's evidence before publishing progress and compressing its findings.
      searchUpdates = await researchSearchUpdates(context);
      yield progress();
      const compressed = researchFindings.parse(
        // oxlint-disable-next-line no-await-in-loop -- Commit this topic's compressed notes before the next topic and supervisor decision.
        await context.agent("researchCompressor", {
          message: structuredMessage(
            `${compressResearchSystemPrompt({ date })}\n\n${raw.findings}\n\n${compressResearchSimpleHumanMessage}`
          ),
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
      message: structuredMessage(
        `${finalReportGenerationPrompt({ date, findings: notes.map((note: Readonly<(typeof notes)[number]>): string => note.findings).join("\n"), research_brief: brief.research_brief })}\n\nWrite the complete Markdown report with title ${JSON.stringify(brief.title)}. Return title and content; the workflow will save the document.`
      ),
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
  yield createToolResult(
    { ...saved, format: "report" },
    ORCHESTRATION_COST_USD,
    [...updates, ...searchUpdates]
  );
}
