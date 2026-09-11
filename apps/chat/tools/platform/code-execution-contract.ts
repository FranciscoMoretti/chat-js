import type { Tool } from "ai";
import type { CostAccumulator } from "@/lib/credits/cost-accumulator";

// Input and output consumed by the existing code-execution renderer.
export interface CodeExecutionInput {
  code: string;
  language: "python" | "javascript";
  title: string;
}

export interface CodeExecutionResult {
  chart: string | { base64: string; format: string } | Record<string, unknown>;
  message: string;
}

export type CodeExecutionToolFactory = (context: {
  costAccumulator?: CostAccumulator;
}) => Tool<CodeExecutionInput, CodeExecutionResult>;
