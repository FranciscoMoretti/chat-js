import type { WorkflowToolDefinition, ToolDefinition } from "eve/tools";

import type { ToolOutput, ToolResult } from "./tool-result";

/* oxlint-disable id-length, typescript/consistent-type-definitions --
 * id-length (#506): ToolUI uses I; O as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology.
 * typescript/consistent-type-definitions (#559): ToolUI preserves its current alias/interface semantics; declaration merging and implicit index-signature assignability differ between those forms.
 */
type ToolUI<I, O> = {
  input: I;
  output: O extends ToolResult<ToolOutput>
    ? Extract<O, { status: "success" }>["output"]
    : O;
};
/* oxlint-enable id-length, typescript/consistent-type-definitions */

/* oxlint-disable id-length --
 * id-length (#506): NativeToolUI uses T; I; O as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology.
 */
export type NativeToolUI<T> =
  T extends ToolDefinition<infer I, infer O>
    ? ToolUI<I, O>
    : T extends WorkflowToolDefinition<infer I, infer O>
      ? ToolUI<I, O>
      : never;
/* oxlint-enable id-length */

/* oxlint-disable id-length, jsdoc/require-param, jsdoc/require-returns --
 * id-length (#506): defineToolSet uses T; K; I; O as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology.
 * jsdoc/require-param (#534): defineToolSet's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): defineToolSet's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 */
/** Validate each declared EVE definition without widening its input/output types.
 * The pinned EVE DynamicToolSet erases generics and incorrectly fixes approval input to Record<string, unknown>.
 */
export const defineToolSet = <T>(
  tools: T & {
    [K in keyof T]: T[K] extends ToolDefinition<infer I, infer O>
      ? [O] extends [ToolOutput]
        ? ToolDefinition<I, O>
        : never
      : never;
  }
): T => tools;
/* oxlint-enable id-length, jsdoc/require-param, jsdoc/require-returns */
