import type { Sandbox } from "@vercel/sandbox";

import type { createModuleLogger } from "@/lib/logger";

export const supportedExecutionLanguages = ["python", "javascript"] as const;

export type SupportedExecutionLanguage =
  (typeof supportedExecutionLanguages)[number];

export type CodeExecutionChart =
  | string
  | { base64: string; format: string }
  | Record<string, unknown>;

export interface CodeExecutionResult {
  chart: CodeExecutionChart;
  message: string;
}

export interface CodeExecutionContext {
  code: string;
  log: ReturnType<typeof createModuleLogger>;
  requestId: string;
  sandbox: Sandbox;
}
