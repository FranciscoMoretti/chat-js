import { toolOutput } from "eve/tools";

import type { ToolOutput, ToolResult } from "./tool-result";

/* oxlint-disable jsdoc/require-param, jsdoc/require-returns, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types  --
 * import/no-named-export (#527): Preserve the named toolResultToModelOutput API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * import/prefer-default-export (#532): toolResultToModelOutput remains a named API, consistent with no-default-export; adding future exports must not change caller import syntax.
 * jsdoc/require-param (#534): toolResultToModelOutput's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): toolResultToModelOutput's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * no-ternary (#518): toolResultToModelOutput derives branch values with conditional expressions; the enabled prefer-ternary rule also favors this form over assignment-only if statements.
 * typescript/explicit-function-return-type (#560): Keep toolResultToModelOutput's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep toolResultToModelOutput's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): toolResultToModelOutput accepts result: ToolResult<ToolOutput>; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
/** One projection for every metered tool; billing and progress stay out of model context. */
export const toolResultToModelOutput = (result: ToolResult<ToolOutput>) =>
  toolOutput.json(
    result.status === "error" ? { error: result.error } : result.output
  );
/* oxlint-enable jsdoc/require-param, jsdoc/require-returns, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types */
