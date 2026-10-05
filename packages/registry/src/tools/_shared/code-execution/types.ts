import type { createModuleLogger } from "@/lib/logger";

const supportedExecutionLanguages = ["python", "javascript"] as const;

type SupportedExecutionLanguage = (typeof supportedExecutionLanguages)[number];

interface CodeExecutionResult {
  chart: string | { base64: string; format: string } | Record<string, unknown>;
  message: string;
}

interface ExecutionSandbox {
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Vercel SDK command overloads require mutable argument arrays; preserve structural compatibility for both providers.
  runCommand: (command: Readonly<{ cmd: string; args: string[] }>) => Promise<{
    exitCode: number;
    stdout: () => Promise<string>;
    stderr: () => Promise<string>;
  }>;
}

interface CodeExecutionContext {
  code: string;
  log: ReturnType<typeof createModuleLogger>;
  requestId: string;
  sandbox: ExecutionSandbox;
}
export { supportedExecutionLanguages };
export type {
  ExecutionSandbox,
  CodeExecutionContext,
  CodeExecutionResult,
  SupportedExecutionLanguage,
};
