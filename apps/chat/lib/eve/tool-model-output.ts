import type { ToolModelOutput } from "eve/tools";
import { toolOutput } from "eve/tools";

/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { ToolOutput, ToolResult } from "./tool-result";
/* oxlint-enable sort-imports */

/* oxlint-disable typescript/prefer-readonly-parameter-types --

 * typescript/prefer-readonly-parameter-types (#565): toolResultToModelOutput accepts result: ToolResult<ToolOutput>; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
  */
/** One projection for every metered tool; billing and progress stay out of model context.
 * @param {ToolResult<ToolOutput>} result Tool receipt whose completed output is projected into model context.
 * @returns {ToolModelOutput} JSON output or the tool's error, excluding billing and progress metadata.
 */
export const toolResultToModelOutput = (
  result: ToolResult<ToolOutput>
): ToolModelOutput =>
  toolOutput.json(
    result.status === "error" ? { error: result.error } : result.output
  );
/* oxlint-enable typescript/prefer-readonly-parameter-types */
