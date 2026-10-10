import type { ToolModelOutput } from "eve/tools";
import { toolOutput } from "eve/tools";

/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { ToolOutput, ToolResult } from "./tool-result";
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (toolResultToModelOutput); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable sort-imports */

/** One projection for every metered tool; billing and progress stay out of model context.
 * @param {ToolResult<ToolOutput>} result Tool receipt whose completed output is projected into model context.
 * @returns {ToolModelOutput} JSON output or the tool's error, excluding billing and progress metadata.
 */
export const toolResultToModelOutput = (
  result: ToolResult<ToolOutput>
): ToolModelOutput =>
  toolOutput.json(
    // oxlint-disable-next-line no-ternary -- Keep toolOutput.json argument as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
    result.status === "error" ? { error: result.error } : result.output
  );
/* oxlint-enable import/prefer-default-export, import/no-named-export */
