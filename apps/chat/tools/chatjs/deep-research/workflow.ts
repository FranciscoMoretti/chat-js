/* oxlint-disable eslint/func-style -- EVE compiles top-level async workflow and step declarations. */
/* oxlint-disable eslint/no-await-in-loop -- Adaptive rounds and research topics intentionally run in order. */
import type { WorkflowToolContext } from "eve/tools";
import { z } from "zod";

/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { ToolResult } from "@/lib/eve/tool-result";
/* oxlint-enable sort-imports */
import { createToolResult } from "@/lib/eve/tool-result";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { ResearchUpdate } from "@/tools/platform/research-updates-schema";
/* oxlint-enable sort-imports */

/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import {
  clarifyWithUserInstructions,
  compressResearchSimpleHumanMessage,
  compressResearchSystemPrompt,
  finalReportGenerationPrompt,
  leadResearcherPrompt,
  researchSystemPrompt,
  transformMessagesIntoResearchTopicPrompt,
} from "./prompts";
/* oxlint-enable sort-imports */
import {
  researchBrief,
  researchClarification,
  researchDecision,
  researchFindings,
  researchReport,
} from "./schemas";
import type { researchOutput } from "./schemas";
import { researchSearchUpdates } from "./search-updates";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  prepareResearch,
  researchCompletionTime,
  saveResearchReport,
} from "./steps";
/* oxlint-enable sort-imports */

type ResearchOutput = z.infer<typeof researchOutput>;

const structuredMessage = (message: string): string =>
  `${message}\n\nDeliver the requested fields through the final_output tool. Put any Markdown inside its string fields; do not return prose or JSON text instead of calling the tool.`;

/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
const outputSchema = (schema: z.ZodType) =>
  z.record(z.string(), z.json()).parse(z.toJSONSchema(schema));
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable typescript/explicit-function-return-type */

/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the ordered validation, state transitions, and cleanup in one operation so their sequencing remains reviewable. */
/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
/* oxlint-disable unicorn/max-nested-calls -- Keep this data transformation together so its argument evaluation order and contextual type inference remain explicit. */
/* oxlint-disable eslint/init-declarations -- The value is assigned by the following guarded operation; an invented initial value would hide an uninitialized control-flow branch. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
export async function* executeEveResearch(
  _input: Record<string, never>,
  context: WorkflowToolContext
): AsyncGenerator<ToolResult<ResearchOutput>, void> {
  "use workflow";
  const { config, date, messages, timestamp } = await prepareResearch(context);
  const updates: ResearchUpdate[] = [];
  let searchUpdates: ResearchUpdate[] = [];
  // Native child events own model/search costs. This orchestration receipt adds no charge.
  const progress = () =>
    createToolResult<ResearchOutput>({ searches: [] }, 0, [
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
      message: structuredMessage(
        transformMessagesIntoResearchTopicPrompt({ date, messages })
      ),
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
        message: structuredMessage(
          `${leadResearcherPrompt({ date, max_concurrent_research_units: config.max_concurrent_research_units })}\n\nResearch brief: ${brief.research_brief}\n\nFindings so far:\n${JSON.stringify(notes)}\n\nDecision round ${round + 1} of ${config.max_researcher_iterations + 1}. Return your next decision.`
        ),
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
      let raw: z.infer<typeof researchFindings>;
      try {
        raw = researchFindings.parse(
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
        searchUpdates = await researchSearchUpdates(context).catch(
          () => previousSearchUpdates
        );
        yield progress();
        throw error;
      }
      searchUpdates = await researchSearchUpdates(context);
      yield progress();
      const compressed = researchFindings.parse(
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
        `${finalReportGenerationPrompt({ date, findings: notes.map((note): string => note.findings).join("\n"), research_brief: brief.research_brief })}\n\nWrite the complete Markdown report with title ${JSON.stringify(brief.title)}. Return title and content; the workflow will save the document.`
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
  yield createToolResult({ ...saved, format: "report" }, 0, [
    ...updates,
    ...searchUpdates,
  ]);
}
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/init-declarations */
/* oxlint-enable unicorn/max-nested-calls */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable eslint/max-statements */
