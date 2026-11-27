// ChatJS source: deep-research. Ownership: chatjs/tools/deep-research/chatjs.json.
import { defineWorkflowTool, toolOutput } from "eve/tools";
import { publishResearchReport } from "../lib/research/delivery";
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

// EVE exposes only the error message for a failed delegated turn.
const UNFULFILLED_OUTPUT_SCHEMA =
  "The agent could not produce a result matching the requested schema.";

type ResearchReplyOptions = Readonly<{
  phase: string;
  message: string;
  signal: AbortSignal;
}>;

const sendResearchMessage = async (
  agent: Readonly<AgentSession>,
  options: ResearchReplyOptions,
  schema?: Record<string, z.JSONType>
) => {
  options.signal.throwIfAborted();
  const response = await agent.send(options.message, {
    ...(schema && { outputSchema: schema }),
    signal: options.signal,
  });
  const result = await response.result();
  options.signal.throwIfAborted();
  if (result.status === "cancelled") {
    throw new Error(`Deep Research (${options.phase}) was cancelled`);
  }
  return result;
};

const fencedJson = /^```json[ \t]*\r?\n(?<json>.*?)\r?\n```$/isu;

const researchReply = async <Schema extends z.ZodType>(
  agent: Readonly<AgentSession>,
  options: ResearchReplyOptions & Readonly<{ schema: Schema }>
): Promise<z.output<Schema>> => {
  const schema = outputSchema(options.schema);
  let result = await sendResearchMessage(agent, options, schema);
  let { data } = result;
  if (
    result.status === "failed" &&
    !result.sessionEnded &&
    result.error.message === UNFULFILLED_OUTPUT_SCHEMA
  ) {
    result = await sendResearchMessage(agent, {
      ...options,
      message: `Complete the original research phase using the information already available. Reply with exactly one JSON object matching this JSON Schema. Do not use tools.\n\n${JSON.stringify(schema)}`,
    });
    if (result.status === "completed" && result.reply !== undefined) {
      const reply = result.reply.trim();
      try {
        data = JSON.parse(fencedJson.exec(reply)?.groups?.json ?? reply);
      } catch {
        throw new Error(
          `Deep Research (${options.phase}) returned invalid JSON`
        );
      }
    }
  }
  if (result.status === "failed") {
    throw new Error(
      `Deep Research (${options.phase}): ${result.error.message}`
    );
  }
  if (data === undefined) {
    throw new Error(
      `Deep Research (${options.phase}) ended without structured output`
    );
  }
  const validated = options.schema.safeParse(data);
  if (!validated.success) {
    throw new Error(`Deep Research (${options.phase}) returned invalid fields`);
  }
  return validated.data;
};

// Models can finish tool-assisted research with a normal Markdown reply.
const researchMarkdown = async (
  agent: Readonly<AgentSession>,
  options: ResearchReplyOptions
): Promise<string> => {
  const result = await sendResearchMessage(agent, options);
  if (result.status === "failed") {
    throw new Error(
      `Deep Research (${options.phase}): ${result.error.message}`
    );
  }
  if (result.reply === undefined || result.reply.trim() === "") {
    throw new Error(`Deep Research (${options.phase}) ended without Markdown`);
  }
  return result.reply;
};

const INITIAL_RESEARCH_ROUND = 0;
const RESEARCH_ROUND_INCREMENT = 1;
const BRIEF_UPDATE_INDEX = 1;
const EMPTY_TOPIC_COUNT = 0;

export default defineWorkflowTool({
  availableInSubagents: false,
  description:
    "Conduct deep research using installed EVE capabilities and sandbox files. Supply the full task and relevant conversation context in request. Use only for explicit deep research requests, once per turn. Returns a Markdown report and its path in the shared sandbox. If the result contains an artifact, the report is already delivered. Otherwise use your channel's native file delivery if available, or explain where the file is. If clarification is needed, ask the returned questions. If research fails, report the error instead of starting duplicate research.",
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
      const clarification = await researchReply(context.agent("agent"), {
        signal: context.abortSignal,
        message: structuredMessage(
          clarifyWithUserInstructions({ date, messages })
        ),
        phase: "clarification",
        schema: researchClarification,
      });
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
    const brief = await researchReply(context.agent("agent"), {
      signal: context.abortSignal,
      message: structuredMessage(
        transformMessagesIntoResearchTopicPrompt({ date, messages })
      ),
      phase: "research brief",
      schema: researchBrief,
    });
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
      // oxlint-disable-next-line no-await-in-loop -- Each decision consumes the findings added by the preceding round.
      const decision = await researchReply(context.agent("agent"), {
        signal: context.abortSignal,
        message: structuredMessage(
          `${leadResearcherPrompt({ date, max_concurrent_research_units: config.max_concurrent_research_units })}\n\nResearch brief: ${findings[0]}\n\nFindings so far:\n${findings.slice(1).join("\n\n")}\n\nDecision round ${round + RESEARCH_ROUND_INCREMENT} of ${config.max_researcher_iterations + RESEARCH_ROUND_INCREMENT}. Return your next decision.`
        ),
        phase: "supervisor decision",
        schema: decisionSchema,
      });
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
        // oxlint-disable-next-line no-await-in-loop -- Complete the topic before moving to the next research stage.
        const raw = await researchMarkdown(context.agent("agent"), {
          signal: context.abortSignal,
          message: `${researchSystemPrompt({ date, max_search_queries: config.search_api_max_queries, mcp_prompt: "Use eve__search to discover installed search/retrieval connections and eve__tool to call them. Use native read_file or bash for relevant sandbox files. Do not call deepResearch recursively. If current external evidence is needed but no search capability is installed, say so explicitly; never fabricate sources." })}\n\nResearch brief:\n${findings[0]}\n\nTopic:\n${topic}\n\nReturn comprehensive raw findings as Markdown with source URLs, citations, uncertainties, and conflicting evidence.`,
          phase: "source findings",
        });
        const topicNumber = noteFiles.length + 1;
        const sourceFile = `topic-${topicNumber}-sources.md`;
        // oxlint-disable-next-line no-await-in-loop -- Preserve cited source findings before compression.
        await writeResearchFile(context, sourceFile, `# ${topic}\n\n${raw}`);
        // oxlint-disable-next-line no-await-in-loop -- Compression consumes the saved source file.
        const [sources] = await readResearchFiles(context, [sourceFile]);
        // oxlint-disable-next-line no-await-in-loop -- Commit this topic's compressed notes before the next topic and supervisor decision.
        const compressed = await researchMarkdown(context.agent("agent"), {
          signal: context.abortSignal,
          message: `${compressResearchSystemPrompt({ date })}\n\n${sources}\n\n${compressResearchSimpleHumanMessage}`,
          phase: "compressing findings",
        });
        const noteFile = `topic-${topicNumber}-notes.md`;
        // oxlint-disable-next-line no-await-in-loop -- Commit notes before advancing the supervisor.
        await writeResearchFile(
          context,
          noteFile,
          `# ${topic}\n\n${compressed}`
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
    const report = await researchMarkdown(context.agent("agent"), {
      signal: context.abortSignal,
      message: `${finalReportGenerationPrompt({ date, findings: savedNotes.join("\n"), research_brief: savedBrief })}\n\nWrite the complete report as Markdown with title ${JSON.stringify(brief.title)}. The workflow will publish your reply as a Markdown file.`,
      phase: "final report",
    });
    context.abortSignal.throwIfAborted();
    const reportPath = await writeResearchFile(context, "report.md", report);
    const artifact = await publishResearchReport(context, report);
    context.abortSignal.throwIfAborted();
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
      {
        path: reportPath,
        title: brief.title,
        format: "report",
        ...(artifact && { artifact }),
      },
      updates
    );
  },
  inputSchema: researchInput,
  toModelOutput: (result) => toolOutput.json(result.output),
});
