import type { ToolContext } from "eve/tools";

import type { ToolOutput, ToolResult } from "./tool-result";

export type CodeExecutionInput = Readonly<{
  code: string;
  language: "python" | "javascript";
  title: string;
}>;
export type CodeExecutionContext = Pick<
  ToolContext,
  "abortSignal" | "callId" | "session"
>;
export type CodeExecutionOutput = { chart: ToolOutput; message: string };
/** Executes exact source and owns its single usage receipt under the invoking tool call. */
export type CodeExecutor = (
  input: CodeExecutionInput,
  context: CodeExecutionContext
) => Promise<ToolResult<CodeExecutionOutput>>;
