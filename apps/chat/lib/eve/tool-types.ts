import type { ToolDefinition, WorkflowToolDefinition } from "eve/tools";

import type { ToolOutput, ToolResult } from "./tool-result";

/* oxlint-disable typescript/consistent-type-definitions --
 * typescript/consistent-type-definitions (#559): ToolUI preserves its current alias/interface semantics; declaration merging and implicit index-signature assignability differ between those forms.
 */
type ToolUI<Input, Output> = {
  input: Input;
  output: Output extends ToolResult<ToolOutput>
    ? Extract<Output, { status: "success" }>["output"]
    : Output;
};
/* oxlint-disable import/no-named-export -- Keep the named type bindings (NativeToolUI); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable typescript/consistent-type-definitions */

export type NativeToolUI<Definition> =
  Definition extends ToolDefinition<infer Input, infer Output>
    ? ToolUI<Input, Output>
    : Definition extends WorkflowToolDefinition<infer Input, infer Output>
      ? ToolUI<Input, Output>
      : never;
/* oxlint-enable import/no-named-export */

/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (defineToolSet); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/** Validate each declared EVE definition without widening its input/output types.
 * The pinned EVE DynamicToolSet erases generics and incorrectly fixes approval input to Record<string, unknown>.
 * @param {Definitions & { [Name in keyof Definitions]: Definitions[Name] extends ToolDefinition< infer Input, infer Output > ? [Output] extends [ToolOutput] ? ToolDefinition<Input, Output> : never : never; }} tools EVE tool definitions whose successful outputs satisfy the application ToolOutput contract.
 * @returns {Definitions} The same definition set, retaining each tool's exact input and output types.
 */
export const defineToolSet = <Definitions>(
  tools: Definitions & {
    [Name in keyof Definitions]: Definitions[Name] extends ToolDefinition<
      infer Input,
      infer Output
    >
      ? [Output] extends [ToolOutput]
        ? ToolDefinition<Input, Output>
        : never
      : never;
  }
): Definitions => tools;
/* oxlint-enable import/no-named-export */
