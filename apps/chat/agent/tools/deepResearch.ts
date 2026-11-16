// ChatJS source: deep-research. Ownership: chatjs/tools/deep-research/chatjs.json.
import { defineWorkflowTool, toolOutput } from "eve/tools";
import {
  clarifyWithUserInstructions,
  compressResearchSimpleHumanMessage,
  compressResearchSystemPrompt,
  finalReportGenerationPrompt,
  leadResearcherPrompt,
  researchSystemPrompt,
  transformMessagesIntoResearchTopicPrompt,
} from "../lib/research/prompts";
import { prepareResearch, researchCompletedAt } from "../lib/research/steps";
import {
  researchBrief,
  researchInput,
  researchClarification,
  researchDecision,
  researchFindings,
  researchReport,
  researchResult,
} from "../lib/research/schemas";
import type { ResearchUpdate } from "../lib/research/schemas";
import type { AgentSession, WorkflowToolContext } from "eve/tools";
import { z } from "zod";

import {
  readResearchFiles,
  writeResearchFile,
} from "../lib/research/workspace";

type ResearchResult = ReturnType<typeof researchResult>;

type ResearchWorkflowContext = Readonly<
  Omit<WorkflowToolContext, "abortSignal"> & {
    abortSignal: Readonly<AbortSignal>;
  }
>;

const structuredMessage = (message: string): string =>
  `${message}\n\nDeliver the requested fields through the eve__reply tool. Put any Markdown inside its string fields; do not return prose or JSON text instead of calling the tool.`;

const outputSchema = (schema: z.ZodType): Record<string, z.JSONType> =>
  z.record(z.string(), z.json()).parse(z.toJSONSchema(schema));

const researchReply = async (
  agent: Readonly<AgentSession>,
  options: Readonly<{
    message: string;
    outputSchema: Record<string, z.JSONType>;
    signal: AbortSignal;
  }>
): Promise<unknown> => {
  options.signal.throwIfAborted();
  const response = await agent.send(options.message, {
    outputSchema: options.outputSchema,
    signal: options.signal,
  });
  const result = await response.result();
  options.signal.throwIfAborted();
  if (result.status === "failed") {
    throw new Error(result.error?.message ?? "Research agent failed");
  }
  if (result.data === undefined) {
    throw new Error("Research agent ended without structured output");
  }
  return result.data;
};

const INITIAL_RESEARCH_ROUND = 0;
const RESEARCH_ROUND_INCREMENT = 1;
const BRIEF_UPDATE_INDEX = 1;
const EMPTY_TOPIC_COUNT = 0;

export default defineWorkflowTool({
  availableInSubagents: false,
  description:
    "Conduct deep research using installed EVE capabilities and sandbox files. Supply the full task and relevant conversation context in request. Use only for explicit deep research requests, once per turn. Returns a Markdown report path in the shared sandbox. After completion, deliver the file using publish_file when installed or your channel's native file delivery. If no delivery mechanism exists, explain where the file is and do not invent a download URL. If clarification is needed, ask the returned questions. If research fails, report the error instead of starting duplicate research.",
  async *execute(
    input: Readonly<z.infer<typeof researchInput>>,
    context: ResearchWorkflowContext
  ): AsyncGenerator<ResearchResult, void> {
    "use workflow";
    const { config, date, messages, timestamp } = await prepareResearch(
      input.request
    );
    const updates: ResearchUpdate[] = [];
    const progress = (): ResearchResult =>
      researchResult({ format: "progress" }, updates);
    if (config.allow_clarification) {
      const clarification = researchClarification.parse(
        await researchReply(context.agent("agent"), {
          signal: context.abortSignal,
          message: structuredMessage(
            clarifyWithUserInstructions({ date, messages })
          ),
          outputSchema: outputSchema(researchClarification),
        })
      );
      if (clarification.need_clarification) {
        yield researchResult({
          answer: clarification.question,
          format: "clarifying_questions",
        });
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
      await researchReply(context.agent("agent"), {
        signal: context.abortSignal,
        message: structuredMessage(
          transformMessagesIntoResearchTopicPrompt({ date, messages })
        ),
        outputSchema: outputSchema(researchBrief),
      })
    );
    await writeResearchFile(context, "brief.md", brief.research_brief);
    updates[BRIEF_UPDATE_INDEX] = {
      message: brief.research_brief,
      status: "completed",
      title: "Writing research brief",
      toolCallId: context.callId,
      type: "writing",
    };
    yield progress();

    const noteFiles: string[] = [];
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
      // oxlint-disable-next-line no-await-in-loop -- Each decision reads the notes completed by preceding research rounds.
      const findings = await readResearchFiles(context, [
        "brief.md",
        ...noteFiles,
      ]);
      const decision = decisionSchema.parse(
        // oxlint-disable-next-line no-await-in-loop -- Each decision consumes the findings added by the preceding round.
        await researchReply(context.agent("agent"), {
          signal: context.abortSignal,
          message: structuredMessage(
            `${leadResearcherPrompt({ date, max_concurrent_research_units: config.max_concurrent_research_units })}\n\nResearch brief: ${findings[0]}\n\nFindings so far:\n${findings.slice(1).join("\n\n")}\n\nDecision round ${round + RESEARCH_ROUND_INCREMENT} of ${config.max_researcher_iterations + RESEARCH_ROUND_INCREMENT}. Return your next decision.`
          ),
          outputSchema: outputSchema(decisionSchema),
        })
      );
      if (decision.complete) {
        break;
      }
      if (decision.topics.length === EMPTY_TOPIC_COUNT) {
        throw new Error(
          "The research supervisor must select topics or finish."
        );
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
          // oxlint-disable-next-line no-await-in-loop -- Complete the topic before moving to the next research stage.
          await researchReply(context.agent("agent"), {
            signal: context.abortSignal,
            message: structuredMessage(
              `${researchSystemPrompt({ date, max_search_queries: config.search_api_max_queries, mcp_prompt: "Use eve__search to discover installed search/retrieval connections and eve__tool to call them. Use native read_file or bash for relevant sandbox files. Do not call deepResearch recursively. If current external evidence is needed but no search capability is installed, say so explicitly; never fabricate sources." })}\n\nResearch brief:\n${findings[0]}\n\nTopic:\n${topic}\n\nReturn comprehensive raw findings with source URLs, citations, uncertainties, and conflicting evidence.`
            ),
            outputSchema: outputSchema(researchFindings),
          })
        );
        const topicNumber = noteFiles.length + 1;
        const sourceFile = `topic-${topicNumber}-sources.md`;
        // oxlint-disable-next-line no-await-in-loop -- Preserve cited source findings before compression.
        await writeResearchFile(
          context,
          sourceFile,
          `# ${topic}\n\n${raw.findings}`
        );
        // oxlint-disable-next-line no-await-in-loop -- Compression consumes the saved source file.
        const [sources] = await readResearchFiles(context, [sourceFile]);
        const compressed = researchFindings.parse(
          // oxlint-disable-next-line no-await-in-loop -- Commit this topic's compressed notes before the next topic and supervisor decision.
          await researchReply(context.agent("agent"), {
            signal: context.abortSignal,
            message: structuredMessage(
              `${compressResearchSystemPrompt({ date })}\n\n${sources}\n\n${compressResearchSimpleHumanMessage}`
            ),
            outputSchema: outputSchema(researchFindings),
          })
        );
        const noteFile = `topic-${topicNumber}-notes.md`;
        // oxlint-disable-next-line no-await-in-loop -- Commit notes before advancing the supervisor.
        await writeResearchFile(
          context,
          noteFile,
          `# ${topic}\n\n${compressed.findings}`
        );
        noteFiles.push(noteFile);
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
    const [savedBrief, ...savedNotes] = await readResearchFiles(context, [
      "brief.md",
      ...noteFiles,
    ]);
    const report = researchReport.parse(
      await researchReply(context.agent("agent"), {
        signal: context.abortSignal,
        message: structuredMessage(
          `${finalReportGenerationPrompt({ date, findings: savedNotes.join("\n"), research_brief: savedBrief })}\n\nWrite the complete Markdown report with title ${JSON.stringify(brief.title)}. Return title and content; the workflow will publish the report as a Markdown file.`
        ),
        outputSchema: outputSchema(researchReport),
      })
    );
    context.abortSignal.throwIfAborted();
    const reportPath = await writeResearchFile(
      context,
      "report.md",
      report.content
    );
    const completedAt = await researchCompletedAt();
    updates[reportUpdateIndex] = {
      status: "completed",
      title: "Writing final report",
      toolCallId: context.callId,
      type: "writing",
    };
    updates.push({
      timestamp: completedAt,
      title: "Research complete",
      toolCallId: context.callId,
      type: "completed",
    });
    yield researchResult(
      { path: reportPath, title: report.title, format: "report" },
      updates
    );
  },
  inputSchema: researchInput,
  toModelOutput: (result) => toolOutput.json(result.output),
});
