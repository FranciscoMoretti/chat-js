import type { ToolContext } from "eve/tools";

import type { ToolOutput, ToolResult } from "./tool-result";

/* oxlint-disable import/group-exports  --
 * import/group-exports (#523): CodeExecutionInput stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named CodeExecutionInput API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 */
export type CodeExecutionInput = Readonly<{
  code: string;
  language: "python" | "javascript";
  title: string;
}>;
/* oxlint-enable import/group-exports */
/* oxlint-disable import/group-exports  --
 * import/group-exports (#523): CodeExecutionContext stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named CodeExecutionContext API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 */
export type CodeExecutionContext = Pick<
  ToolContext,
  "abortSignal" | "callId" | "session"
>;
/* oxlint-enable import/group-exports */
/* oxlint-disable import/group-exports, typescript/consistent-type-definitions  --
 * import/group-exports (#523): CodeExecutionOutput stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named CodeExecutionOutput API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * typescript/consistent-type-definitions (#559): CodeExecutionOutput preserves its current alias/interface semantics; declaration merging and implicit index-signature assignability differ between those forms.
 */
export type CodeExecutionOutput = { chart: ToolOutput; message: string };
/* oxlint-enable import/group-exports, typescript/consistent-type-definitions */
/* oxlint-disable import/group-exports, typescript/prefer-readonly-parameter-types  --
 * import/group-exports (#523): CodeExecutor stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named CodeExecutor API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * typescript/prefer-readonly-parameter-types (#565): CodeExecutor accepts context: CodeExecutionContext; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
/** Executes exact source and owns its single usage receipt under the invoking tool call. */
export type CodeExecutor = (
  input: CodeExecutionInput,
  context: CodeExecutionContext
) => Promise<ToolResult<CodeExecutionOutput>>;
/* oxlint-enable import/group-exports, typescript/prefer-readonly-parameter-types */
