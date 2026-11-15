import type { SandboxSession } from "eve/sandbox";
import type { createModuleLogger } from "@/lib/logger";

const supportedExecutionLanguages = ["python", "javascript"] as const;

type SupportedExecutionLanguage = (typeof supportedExecutionLanguages)[number];

interface CodeExecutionResult {
  chart: string | { base64: string; format: string } | Record<string, unknown>;
  message: string;
}

type ExecutionSandbox = Pick<SandboxSession, "run">;

interface CodeExecutionContext {
  code: string;
  log: ReturnType<typeof createModuleLogger>;
  requestId: string;
  sandbox: ExecutionSandbox;
  signal: AbortSignal;
}
export { supportedExecutionLanguages };
export type {
  ExecutionSandbox,
  CodeExecutionContext,
  CodeExecutionResult,
  SupportedExecutionLanguage,
};
