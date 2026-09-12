import { generateText, Output, streamText } from "ai";
import type { ModelMessage } from "ai";
import type { z } from "zod";

import type { AppModelId, ModelId } from "@/lib/ai/app-models";
import { getLanguageModel } from "@/lib/ai/providers";
import { truncateMessages } from "@/lib/ai/token-utils";
import { generateUUID, getTextContentFromModelMessage } from "@/lib/utils";

import { createTextDocumentTool } from "../documents/create-text-document";
import type { DocumentToolResult } from "../documents/types";
import type { ToolSession } from "../types";
import type { DeepResearchRuntimeConfig } from "./configuration";
import {
  clarifyWithUserInstructions,
  finalReportGenerationPrompt,
  transformMessagesIntoResearchTopicPrompt,
} from "./prompts";
import { runSupervisor } from "./supervisor-agent";
import {
  ClarifyWithUserSchema,
  createTelemetry,
  ResearchQuestionSchema,
} from "./types";
import type {
  AgentOptions,
  DeepResearchInput,
  DeepResearchResult,
} from "./types";
import { getModelContextWindow, getTodayStr } from "./utils";

// Main deep research pipeline
export async function runDeepResearchPipeline(
  input: DeepResearchInput,
  config: DeepResearchRuntimeConfig,
  dataStream: AgentOptions["dataStream"],
  options: {
    session: ToolSession;
    costAccumulator: NonNullable<AgentOptions["costAccumulator"]>;
    abortSignal?: AbortSignal;
  }
): Promise<DeepResearchResult> {
  const { session, costAccumulator, abortSignal } = options;
  console.log("runDeepResearchPipeline invoked", {
    messageId: input.messageId,
    requestId: input.requestId,
  });

  const ctx: AgentOptions = {
    abortSignal,
    config,
    costAccumulator,
    dataStream,
    messageId: input.messageId,
    requestId: input.requestId,
    toolCallId: input.toolCallId,
  };

  // Step 1: Clarify with user
  const clarification = await clarifyWithUser(input.messages, ctx);

  if (clarification.needsClarification) {
    return {
      data: clarification.clarificationMessage,
      type: "clarifying_question",
    };
  }

  dataStream.write({
    data: {
      timestamp: Date.now(),
      title: "Starting research",
      toolCallId: input.toolCallId,
      type: "started",
    },
    type: "data-researchUpdate",
  });

  // Step 2: Write research brief
  const brief = await writeResearchBrief(input.messages, ctx);

  // Step 3: Supervisor research loop
  const notes = await runSupervisor(brief.research_brief, ctx);

  // Step 4: Final report generation
  const reportResult = await generateFinalReport({
    ...ctx,
    notes,
    reportTitle: brief.title,
    researchBrief: brief.research_brief,
    session,
  });

  dataStream.write({
    data: {
      timestamp: Date.now(),
      title: "Research complete",
      toolCallId: input.toolCallId,
      type: "completed",
    },
    type: "data-researchUpdate",
  });

  return {
    data: reportResult,
    type: "report",
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

  const model = await getLanguageModel(config.research_model as ModelId);
  const contextWindow = await getModelContextWindow(
    config.research_model as ModelId
  );

  const clarifyMessages = [
    {
      content: clarifyWithUserInstructions({
        date: getTodayStr(),
        messages: messagesToString(messages),
      }),
      role: "user" as const,
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
      clarificationMessage: output.question,
      needsClarification: true,
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
  const model = await getLanguageModel(config.research_model as ModelId);
  const dataPartId = generateUUID();

  dataStream.write({
    data: {
      status: "running",
      title: "Writing research brief",
      toolCallId,
      type: "writing",
    },
    id: dataPartId,
    type: "data-researchUpdate",
  });

  const contextWindow = await getModelContextWindow(
    config.research_model as ModelId
  );

  const briefMessages = [
    {
      content: transformMessagesIntoResearchTopicPrompt({
        date: getTodayStr(),
        messages: messagesToString(messages),
      }),
      role: "user" as const,
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
    data: {
      message: output.research_brief,
      status: "completed",
      title: "Writing research brief",
      toolCallId,
      type: "writing",
    },
    id: dataPartId,
    type: "data-researchUpdate",
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
  session: ToolSession;
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
    session,
    messageId,
    toolCallId,
    costAccumulator,
    abortSignal,
  } = input;

  const findings = notes.join("\n");

  const finalReportPromptText = finalReportGenerationPrompt({
    date: getTodayStr(),
    findings,
    research_brief: researchBrief,
  });

  const finalReportUpdateId = generateUUID();
  dataStream.write({
    data: {
      status: "running",
      title: "Writing final report",
      toolCallId,
      type: "writing",
    },
    id: finalReportUpdateId,
    type: "data-researchUpdate",
  });

  const contextWindow = await getModelContextWindow(
    config.final_report_model as ModelId
  );

  const finalReportMessages = [
    { content: finalReportPromptText, role: "user" as const },
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

  const reportTool = createTextDocumentTool({
    costAccumulator,
    messageId,
    selectedModel: config.final_report_model as ModelId,
    session,
  });

  const systemPrompt = `You are a research report writer. Your task is to write the final research report and save it using the createTextDocument tool.

IMPORTANT: You MUST call the createTextDocument tool with the complete report content. Do not output the report as text - save it using the tool.`;

  const result = streamText({
    model: await getLanguageModel(config.final_report_model as ModelId),
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

  dataStream.merge(result.toUIMessageStream());

  const usage = await result.usage;
  if (usage) {
    costAccumulator?.addLLMCost(
      config.final_report_model as AppModelId,
      usage,
      "deep-research-final-report"
    );
  }

  const createdDocumentToolResult = (await result.toolResults).find(
    (tr) => tr?.toolName === "createTextDocument"
  );

  dataStream.write({
    data: {
      status: "completed",
      title: "Writing final report",
      toolCallId,
      type: "writing",
    },
    id: finalReportUpdateId,
    type: "data-researchUpdate",
  });

  if (!createdDocumentToolResult) {
    return {
      error: "createTextDocument tool was not called",
      status: "error",
    };
  }

  const output =
    createdDocumentToolResult.output as unknown as DocumentToolResult;
  if (output.status === "error") {
    return {
      error: output.error,
      status: "error",
    };
  }

  return {
    date: output.date,
    documentId: output.documentId,
    result: "A document was created and is now visible to the user.",
    status: "success",
  };
}

// Helpers

function messagesToString(messages: ModelMessage[]): string {
  return messages
    .map((m) => `${m.role}: ${JSON.stringify(m.content)}`)
    .join("\n");
}
