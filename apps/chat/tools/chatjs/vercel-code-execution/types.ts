import type { Sandbox } from "@vercel/sandbox";

import type { createModuleLogger } from "@/lib/logger";

export const supportedExecutionLanguages = ["python", "javascript"] as const;

export type SupportedExecutionLanguage =
  (typeof supportedExecutionLanguages)[number];

export interface CodeExecutionResult {
  chart: string | { base64: string; format: string } | Record<string, unknown>;
  message: string;
}

export interface CodeExecutionContext {
  code: string;
  log: ReturnType<typeof createModuleLogger>;
  requestId: string;
  sandbox: Sandbox;
}
