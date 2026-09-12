import type { ModelMessage } from "ai";
import { z } from "zod";

import { chatTelemetry } from "@/lib/ai/telemetry";
import type { StreamWriter } from "@/lib/ai/types";
import type { CostAccumulator } from "@/lib/credits/cost-accumulator";

import type { DocumentToolResult } from "../documents/types";
import type { DeepResearchRuntimeConfig } from "./configuration";

//##################
// Shared Agent Options
//##################

export interface AgentOptions {
  abortSignal?: AbortSignal;
  config: DeepResearchRuntimeConfig;
  costAccumulator?: CostAccumulator;
  dataStream: StreamWriter;
  messageId: string;
  requestId: string;
  toolCallId: string;
}

//##################
// Telemetry Helper
//##################

export const createTelemetry = (
  functionId: string,
  options: Pick<AgentOptions, "messageId" | "requestId">
) => ({
  runtimeContext: {
    langfuseTraceId: options.requestId,
    langfuseUpdateParent: false,
    messageId: options.messageId,
  },
  telemetry: {
    functionId,
    includeRuntimeContext: {
      langfuseTraceId: true,
      langfuseUpdateParent: true,
      messageId: true,
    },
    integrations: chatTelemetry,
    isEnabled: true,
  },
});

//##################
// Structured Outputs (Zod Schemas)
//##################

export const ClarifyWithUserSchema = z.object({
  need_clarification: z
    .boolean()
    .describe("Whether the user needs to be asked a clarifying question."),
  question: z
    .string()
    .describe("A question to ask the user to clarify the report scope"),
  verification: z
    .string()
    .describe(
      "Verify message that we will start research after the user has provided the necessary information."
    ),
});

export const ResearchQuestionSchema = z.object({
  research_brief: z
    .string()
    .describe("A research question that will be used to guide the research."),
  title: z.string().describe("The title of the research report."),
});

//##################
// Pipeline IO
//##################

export interface DeepResearchInput {
  messageId: string;
  messages: ModelMessage[];
  requestId: string;
  toolCallId: string;
}

export type DeepResearchResult =
  | {
      type: "clarifying_question";
      data: string;
    }
  | {
      type: "report";
      data: DocumentToolResult;
    };
