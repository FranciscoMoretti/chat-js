import { z } from "zod";

/* oxlint-disable import/exports-last, import/group-exports --
 * import/exports-last (#522): ToolOutput is directly exported at its declaration; moving it below executable initialization can obscure ordering and API ownership.
 * import/group-exports (#523): ToolOutput stays exported at its declaration so its public contract is visible beside its implementation.
 */
/** JSON values, permitting optional object properties omitted by persistence. */
export type ToolOutput =
  | string
  | number
  | boolean
  | null
  | ToolOutput[]
  | { [key: string]: ToolOutput | undefined };
/* oxlint-enable import/exports-last, import/group-exports */
const jsonOutput: z.ZodType<ToolOutput> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonOutput),
    z.record(z.string(), jsonOutput.optional()),
  ])
);
/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): base uses 1 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 */
const base = z.object({
  kind: z.literal("chatjs.tool-result"),
  updates: z.array(jsonOutput).optional(),
  version: z.literal(1),
});
/* oxlint-enable no-magic-numbers */
/* oxlint-disable import/exports-last, import/group-exports --
 * import/exports-last (#522): toolOutputSchema is directly exported at its declaration; moving it below executable initialization can obscure ordering and API ownership.
 * import/group-exports (#523): toolOutputSchema stays exported at its declaration so its public contract is visible beside its implementation.
 */
export const toolOutputSchema = z.discriminatedUnion("status", [
  base.extend({ output: jsonOutput, status: z.literal("success") }),
  base.extend({
    error: z.string(),
    output: z.null(),
    status: z.literal("error"),
  }),
]);
/* oxlint-enable import/exports-last, import/group-exports */
const usage = z.object({
  costUsd: z.number().nonnegative().optional(),
});
/* oxlint-disable import/group-exports --
 * import/group-exports (#523): toolResultSchema stays exported at its declaration so its public contract is visible beside its implementation.
 */
export const toolResultSchema = z.intersection(
  toolOutputSchema,
  z.object({ usage })
);
/* oxlint-enable import/group-exports */
/* oxlint-disable id-length, import/group-exports, no-magic-numbers --
 * id-length (#506): ToolResult uses T as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology.
 * import/group-exports (#523): ToolResult stays exported at its declaration so its public contract is visible beside its implementation.
 * no-magic-numbers (#517): ToolResult uses 1 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 */
export type ToolResult<T extends ToolOutput> = {
  kind: "chatjs.tool-result";
  version: 1;
  usage: { costUsd?: number };
  updates?: ToolOutput[];
} & (
  | { status: "success"; output: T }
  | { status: "error"; output: null; error: string }
);
/* oxlint-enable id-length, import/group-exports, no-magic-numbers */

/* oxlint-disable import/group-exports --
 * import/group-exports (#523): hasEveToolReceipt stays exported at its declaration so its public contract is visible beside its implementation.
 */
export const hasEveToolReceipt = (value: unknown): boolean =>
  typeof value === "object" &&
  value !== null &&
  "kind" in value &&
  value.kind === "chatjs.tool-result";
/* oxlint-enable import/group-exports */

/* oxlint-disable id-length, import/group-exports, typescript/prefer-readonly-parameter-types --
 * id-length (#506): createToolResult uses T as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology.
 * import/group-exports (#523): createToolResult stays exported at its declaration so its public contract is visible beside its implementation.
 * typescript/prefer-readonly-parameter-types (#565): createToolResult accepts updates?: ToolOutput[]; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
export const createToolResult = <T extends ToolOutput>(
  output: T,
  costUsd: number | undefined,
  updates?: ToolOutput[]
): ToolResult<T> => {
  jsonOutput.parse(output);
  usage.parse({ costUsd });
  if (updates) {
    z.array(jsonOutput).parse(updates);
  }
  return {
    kind: "chatjs.tool-result",
    output,
    status: "success",
    updates,
    usage: { costUsd },
    version: 1,
  };
};
/* oxlint-enable id-length, import/group-exports, typescript/prefer-readonly-parameter-types */
/* oxlint-disable import/group-exports, typescript/prefer-readonly-parameter-types, unicorn/no-null --
 * import/group-exports (#523): createToolError stays exported at its declaration so its public contract is visible beside its implementation.
 * typescript/prefer-readonly-parameter-types (#565): createToolError accepts updates?: ToolOutput[]; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * unicorn/no-null (#570): createToolError preserves explicit null in its storage/API state; undefined has different serialization and presence semantics.
 */
export const createToolError = (
  costUsd: number | undefined,
  updates?: ToolOutput[]
): ToolResult<never> => ({
  ...createToolResult(null, costUsd, updates),
  error: "The tool did not complete.",
  output: null,
  status: "error",
});
/* oxlint-enable import/group-exports, typescript/prefer-readonly-parameter-types, unicorn/no-null */
