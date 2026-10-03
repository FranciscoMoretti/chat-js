import type { ToolContext } from "eve/tools";

import type { ToolOutput, ToolResult } from "./tool-result";

type CodeExecutionInput = Readonly<{
  code: string;
  language: "python" | "javascript";
  title: string;
}>;

type CodeExecutionContext = Pick<
  ToolContext,
  "abortSignal" | "callId" | "session"
>;

/* oxlint-disable typescript/consistent-type-definitions -- typescript/consistent-type-definitions (#559): CodeExecutionOutput preserves its current alias/interface semantics; declaration merging and implicit index-signature assignability differ between those forms. */
type CodeExecutionOutput = { chart: ToolOutput; message: string };
/* oxlint-enable typescript/consistent-type-definitions */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- typescript/prefer-readonly-parameter-types (#565): CodeExecutor accepts context: CodeExecutionContext; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration. */
/** Executes exact source and owns its single usage receipt under the invoking tool call. */
type CodeExecutor = (
  input: CodeExecutionInput,
  context: CodeExecutionContext
) => Promise<ToolResult<CodeExecutionOutput>>;
/* oxlint-enable typescript/prefer-readonly-parameter-types */
export type {
  CodeExecutionContext,
  CodeExecutionInput,
  CodeExecutionOutput,
  CodeExecutor,
};
