import { z } from "zod";

/** JSON values, permitting optional object properties omitted by persistence. */
type ToolOutput =
  | string
  | number
  | boolean
  | null
  | ToolOutput[]
  | { [key: string]: ToolOutput | undefined };

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

const toolOutputSchema = z.discriminatedUnion("status", [
  base.extend({ output: jsonOutput, status: z.literal("success") }),
  base.extend({
    error: z.string(),
    output: z.null(),
    status: z.literal("error"),
  }),
]);

const usage = z.object({
  costUsd: z.number().nonnegative().optional(),
});

const toolResultSchema = z.intersection(toolOutputSchema, z.object({ usage }));

/* oxlint-disable id-length, no-magic-numbers -- id-length (#506): ToolResult uses T as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology.
no-magic-numbers (#517): ToolResult uses 1 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions. */
type ToolResult<T extends ToolOutput> = {
  kind: "chatjs.tool-result";
  version: 1;
  usage: { costUsd?: number };
  updates?: ToolOutput[];
} & (
  | { status: "success"; output: T }
  | { status: "error"; output: null; error: string }
);
/* oxlint-enable id-length, no-magic-numbers */

const hasEveToolReceipt = (value: unknown): boolean =>
  typeof value === "object" &&
  value !== null &&
  "kind" in value &&
  value.kind === "chatjs.tool-result";

/* oxlint-disable id-length, typescript/prefer-readonly-parameter-types -- id-length (#506): createToolResult uses T as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology.
typescript/prefer-readonly-parameter-types (#565): createToolResult accepts updates?: ToolOutput[]; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration. */
const createToolResult = <T extends ToolOutput>(
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
/* oxlint-enable id-length, typescript/prefer-readonly-parameter-types */
/* oxlint-disable typescript/prefer-readonly-parameter-types, unicorn/no-null -- typescript/prefer-readonly-parameter-types (#565): createToolError accepts updates?: ToolOutput[]; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
unicorn/no-null (#570): createToolError preserves explicit null in its storage/API state; undefined has different serialization and presence semantics. */
const createToolError = (
  costUsd: number | undefined,
  updates?: ToolOutput[]
): ToolResult<never> => ({
  ...createToolResult(null, costUsd, updates),
  error: "The tool did not complete.",
  output: null,
  status: "error",
});
/* oxlint-enable typescript/prefer-readonly-parameter-types, unicorn/no-null */
export {
  createToolError,
  createToolResult,
  hasEveToolReceipt,
  toolOutputSchema,
  toolResultSchema,
};
export type { ToolOutput, ToolResult };
