/* oxlint-disable eslint/func-style -- EVE compiles top-level async workflow and step declarations. */
/* oxlint-disable eslint/no-await-in-loop -- Adaptive rounds and research topics intentionally run in order. */
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

/* oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- z.toJSONSchema requires the original mutable Zod internals; a recursively readonly schema is not assignable to the native Zod API. */
const outputSchema = (schema: z.ZodType): Record<string, z.JSONType> =>
  z.record(z.string(), z.json()).parse(z.toJSONSchema(schema));
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (executeEveResearch); the enabled import/no-default-export convention rejects the default-export alternative. */
/* oxlint-disable oxc/no-async-await -- Modern targets support the async-iterator protocol; preserve executeEveResearch's asynchronous iteration and rejection behavior. */

/* oxlint-disable eslint/max-statements -- This durable workflow owns ordered clarification, adaptive topic rounds, evidence recovery, and final-save progress. Splitting generator phases changes delegated iterator return/throw and replay boundaries. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the durable generator's progress yields and catch/rethrow recovery together; helper iterators would add observable return/throw delegation at cancellation boundaries. */
const ORCHESTRATION_COST_USD = 0;
const INITIAL_RESEARCH_ROUND = 0;
const RESEARCH_ROUND_INCREMENT = 1;
const BRIEF_UPDATE_INDEX = 1;
const EMPTY_TOPIC_COUNT = 0;
/* oxlint-disable unicorn/max-nested-calls -- Each native agent call resolves its receiver before evaluating prompt/schema arguments, then awaits and parses the result. Hoisting argument expressions changes that evaluation order. */
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
      // oxlint-disable-next-line eslint/init-declarations -- Successful parsing assigns raw; the catch emits preserved search evidence and rethrows before compression. No placeholder findings may cross that boundary.
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
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep saved own-key composition and override order; eslint/prefer-object-spread rejects Object.assign.
    { ...saved, format: "report" },
    ORCHESTRATION_COST_USD,
    [...updates, ...searchUpdates]
  );
}
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable unicorn/max-nested-calls */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable eslint/max-statements */
