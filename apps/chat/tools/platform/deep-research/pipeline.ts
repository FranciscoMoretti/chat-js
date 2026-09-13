import { generateText, type ModelMessage, Output, streamText, tool } from "ai";
import { z } from "zod";

import type { AppModelId, ModelId } from "@/lib/ai/app-models";
import { truncateMessages } from "@/lib/ai/token-utils";
import type { StreamWriter } from "@/lib/ai/types";
import { generateUUID, getTextContentFromModelMessage } from "@/lib/utils";

import type { DocumentToolResult } from "../documents/types";
import type { DeepResearchRuntimeConfig } from "./configuration";
import {
  clarifyWithUserInstructions,
  finalReportGenerationPrompt,
  transformMessagesIntoResearchTopicPrompt,
} from "./prompts";
import { runSupervisor } from "./supervisor-agent";
import {
  type AgentOptions,
  ClarifyWithUserSchema,
  createTelemetry,
  type DeepResearchInput,
  type DeepResearchResult,
  ResearchQuestionSchema,
} from "./types";
import { getTodayStr } from "./utils";

// Main deep research pipeline
export async function runDeepResearchPipeline(
  input: DeepResearchInput,
  config: DeepResearchRuntimeConfig,
  dataStream: AgentOptions["dataStream"],
  options: {
    saveReport: (input: {
      title: string;
      content: string;
    }) => Promise<DocumentToolResult>;
    getLanguageModel: AgentOptions["getLanguageModel"];
    getModelContextWindow: AgentOptions["getModelContextWindow"];
    publishReportStream?: StreamWriter["merge"];
    costAccumulator: NonNullable<AgentOptions["costAccumulator"]>;
    abortSignal?: AbortSignal;
  }
): Promise<DeepResearchResult> {
  const { costAccumulator, abortSignal } = options;
  const ctx: AgentOptions = {
    config,
    dataStream,
    getLanguageModel: options.getLanguageModel,
    getModelContextWindow: options.getModelContextWindow,
    requestId: input.requestId,
    messageId: input.messageId,
    toolCallId: input.toolCallId,
    costAccumulator,
    abortSignal,
  };

  // Step 1: Clarify with user
  const clarification = await clarifyWithUser(input.messages, ctx);

  if (clarification.needsClarification) {
    return {
      type: "clarifying_question",
      data: clarification.clarificationMessage,
    };
  }

  dataStream.write({
    type: "data-researchUpdate",
    data: {
      toolCallId: input.toolCallId,
      title: "Starting research",
      type: "started",
      timestamp: Date.now(),
    },
  });

  // Step 2: Write research brief
  const brief = await writeResearchBrief(input.messages, ctx);

  // Step 3: Supervisor research loop
  const notes = await runSupervisor(brief.research_brief, ctx);

  // Step 4: Final report generation
  const reportResult = await generateFinalReport({
    ...ctx,
    notes,
    researchBrief: brief.research_brief,
    reportTitle: brief.title,
    saveReport: options.saveReport,
    publishReportStream: options.publishReportStream,
  });

  dataStream.write({
    type: "data-researchUpdate",
    data: {
      toolCallId: input.toolCallId,
      title: "Research complete",
      type: "completed",
      timestamp: Date.now(),
    },
  });

  return {
    type: "report",
    data: reportResult,
  };
}

// Step 1: Clarification

type ClarificationResult =
  | { needsClarification: true; clarificationMessage: string }
  | { needsClarification: false; clarificationMessage?: undefined };

async function clarifyWithUser(
  messages: ModelMessage[],
  ctx: AgentOptions
): Promise<ClarificationResult> {
  const { config, costAccumulator, abortSignal } = ctx;

  if (!config.allow_clarification) {
    return { needsClarification: false };
  }

  const model = await ctx.getLanguageModel(config.research_model as ModelId);
  const contextWindow = await ctx.getModelContextWindow(
    config.research_model as ModelId
  );

  const clarifyMessages = [
    {
      role: "user" as const,
      content: clarifyWithUserInstructions({
        messages: messagesToString(messages),
        date: getTodayStr(),
      }),
    },
  ];
  const truncatedMessages = truncateMessages(clarifyMessages, contextWindow);

  const response = await generateText({
    model,
    output: Output.object({ schema: ClarifyWithUserSchema }),
    messages: truncatedMessages,
    maxOutputTokens: config.research_model_max_tokens,
    ...createTelemetry("clarifyWithUser", ctx),
    abortSignal,
  });

  if (response.usage) {
    costAccumulator?.addLLMCost(
      config.research_model as AppModelId,
      response.usage,
      "deep-research-clarify"
    );
  }

  const output = response.output as z.infer<typeof ClarifyWithUserSchema>;
  if (output.need_clarification) {
    return {
      needsClarification: true,
      clarificationMessage: output.question,
    };
  }
  return { needsClarification: false };
}

// Step 2: Research Brief

interface ResearchBrief {
  research_brief: string;
  title: string;
}

async function writeResearchBrief(
  messages: ModelMessage[],
  ctx: AgentOptions
): Promise<ResearchBrief> {
  const { config, dataStream, toolCallId, costAccumulator, abortSignal } = ctx;
  const model = await ctx.getLanguageModel(config.research_model as ModelId);
  const dataPartId = generateUUID();

  dataStream.write({
    id: dataPartId,
    type: "data-researchUpdate",
    data: {
      toolCallId,
      title: "Writing research brief",
      type: "writing",
      status: "running",
    },
  });

  const contextWindow = await ctx.getModelContextWindow(
    config.research_model as ModelId
  );

  const briefMessages = [
    {
      role: "user" as const,
      content: transformMessagesIntoResearchTopicPrompt({
        messages: messagesToString(messages),
        date: getTodayStr(),
      }),
    },
  ];
  const truncatedMessages = truncateMessages(briefMessages, contextWindow);

  const result = await generateText({
    model,
    output: Output.object({ schema: ResearchQuestionSchema }),
    messages: truncatedMessages,
    maxOutputTokens: config.research_model_max_tokens,
    ...createTelemetry("writeResearchBrief", ctx),
    abortSignal,
  });

  if (result.usage) {
    costAccumulator?.addLLMCost(
      config.research_model as AppModelId,
      result.usage,
      "deep-research-brief"
    );
  }

  const output = result.output as z.infer<typeof ResearchQuestionSchema>;

  dataStream.write({
    id: dataPartId,
    type: "data-researchUpdate",
    data: {
      toolCallId,
      title: "Writing research brief",
      message: output.research_brief,
      type: "writing",
      status: "completed",
    },
  });

  return {
    research_brief: output.research_brief,
    title: output.title,
  };
}

// Step 4: Final Report Generation

type FinalReportInput = AgentOptions & {
  notes: string[];
  researchBrief: string;
  reportTitle: string;
  saveReport: (input: {
    title: string;
    content: string;
  }) => Promise<DocumentToolResult>;
  publishReportStream?: StreamWriter["merge"];
};

async function generateFinalReport(
  input: FinalReportInput
): Promise<DocumentToolResult> {
  const {
    notes,
    researchBrief,
    reportTitle,
    config,
    dataStream,
    saveReport,
    publishReportStream,
    toolCallId,
    costAccumulator,
    abortSignal,
  } = input;

  const findings = notes.join("\n");

  const finalReportPromptText = finalReportGenerationPrompt({
    research_brief: researchBrief,
    findings,
    date: getTodayStr(),
  });

  const finalReportUpdateId = generateUUID();
  dataStream.write({
    id: finalReportUpdateId,
    type: "data-researchUpdate",
    data: {
      toolCallId,
      title: "Writing final report",
      type: "writing",
      status: "running",
    },
  });

  const contextWindow = await input.getModelContextWindow(
    config.final_report_model as ModelId
  );

  const finalReportMessages = [
    { role: "user" as const, content: finalReportPromptText },
  ];
  const truncatedMessages = truncateMessages(
    finalReportMessages,
    contextWindow
  );

  const truncatedReportPrompt =
    truncatedMessages.length > 0
      ? truncatedMessages
          .map((msg) => getTextContentFromModelMessage(msg))
          .join("\n\n")
      : finalReportPromptText;

  let savedReport: DocumentToolResult | undefined;
  const reportTool = tool({
    description: "Save the completed research report as a Markdown document.",
    inputSchema: z.object({ title: z.string(), content: z.string() }),
    execute: async (content) => {
      savedReport = await saveReport(content);
      return savedReport;
    },
  });

  const systemPrompt = `You are a research report writer. Your task is to write the final research report and save it using the createTextDocument tool.

IMPORTANT: You MUST call the createTextDocument tool with the complete report content. Do not output the report as text - save it using the tool.`;

  const result = streamText({
    model: await input.getLanguageModel(config.final_report_model as ModelId),
    instructions: systemPrompt,
    prompt: `Write a comprehensive research report with the title "${reportTitle}" based on the following instructions and findings.

${truncatedReportPrompt}

To write the report, call the createTextDocument tool with:
- title: "${reportTitle}"
- content: the full markdown content of your report`,
    tools: { createTextDocument: reportTool },
    maxOutputTokens: config.final_report_model_max_tokens,
    ...createTelemetry("finalReportGeneration", input),
    abortSignal,
  });

  if (publishReportStream) {
    publishReportStream(result.toUIMessageStream());
  } else {
    await result.consumeStream();
  }

  const usage = await result.usage;
  if (usage) {
    costAccumulator?.addLLMCost(
      config.final_report_model as AppModelId,
      usage,
      "deep-research-final-report"
    );
  }

  await result.toolResults;

  dataStream.write({
    id: finalReportUpdateId,
    type: "data-researchUpdate",
    data: {
      toolCallId,
      title: "Writing final report",
      type: "writing",
      status: "completed",
    },
  });

  if (!savedReport) {
    return {
      status: "error",
      error: "createTextDocument tool was not called",
    };
  }

  const output = savedReport;
  if (output.status === "error") {
    return {
      status: "error",
      error: output.error,
    };
  }

  return {
    ...output,
    result: "A document was created and is now visible to the user.",
    date: output.date,
  };
}

// Helpers

function messagesToString(messages: ModelMessage[]): string {
  return messages
    .map((m) => `${m.role}: ${JSON.stringify(m.content)}`)
    .join("\n");
}
