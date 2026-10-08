import type { ToolContext } from "eve/tools";

// oxlint-disable-next-line eslint/sort-imports -- Preserve runtime module evaluation order and keep type-only declarations beside the owning module; the pinned binding-order rule requires a different grouping.
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";

/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { ToolOutput, ToolResult } from "./tool-result";
/* oxlint-enable sort-imports */

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

/** Executes exact source and owns its single usage receipt under the invoking tool call. */
type CodeExecutor = (
  input: CodeExecutionInput,
  context: ReadonlyNativeSurface<CodeExecutionContext>
) => Promise<ToolResult<CodeExecutionOutput>>;
/* oxlint-disable import/no-named-export -- Keep the named type bindings (CodeExecutionContext, CodeExecutionInput, CodeExecutionOutput, CodeExecutor); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */

export type {
  CodeExecutionContext,
  CodeExecutionInput,
  CodeExecutionOutput,
  CodeExecutor,
};
/* oxlint-enable import/no-named-export */
