import type { Sandbox } from "@vercel/sandbox";

import type { createModuleLogger } from "@/lib/logger";

const supportedExecutionLanguages = ["python", "javascript"] as const;

type SupportedExecutionLanguage = (typeof supportedExecutionLanguages)[number];

interface CodeExecutionResult {
  chart: string | { base64: string; format: string } | Record<string, unknown>;
  message: string;
}

interface CodeExecutionContext {
  code: string;
  log: ReturnType<typeof createModuleLogger>;
  requestId: string;
  sandbox: Sandbox;
}
export { supportedExecutionLanguages };
export type {
  CodeExecutionContext,
  CodeExecutionResult,
  SupportedExecutionLanguage,
};
