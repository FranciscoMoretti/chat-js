import type { Sandbox } from "@vercel/sandbox";
import type { createModuleLogger } from "@/lib/logger";

export const supportedExecutionLanguages = ["python", "javascript"] as const;

export type SupportedExecutionLanguage =
  (typeof supportedExecutionLanguages)[number];

export type { CodeExecutionResult } from "@/tools/platform/code-execution-contract";

export interface CodeExecutionContext {
  code: string;
  log: ReturnType<typeof createModuleLogger>;
  requestId: string;
  sandbox: Sandbox;
}
