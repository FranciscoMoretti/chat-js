import { z } from "zod";

/** JSON values, permitting optional object properties omitted by persistence. */
type ToolOutput =
  | string
  | number
  | boolean
  | null
  | readonly ToolOutput[]
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
const TOOL_RESULT_VERSION = 1;

const base = z.object({
  kind: z.literal("chatjs.tool-result"),
  updates: z.array(jsonOutput).optional(),
  version: z.literal(TOOL_RESULT_VERSION),
});

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

type ToolResult<Output extends ToolOutput> = {
  kind: "chatjs.tool-result";
  version: typeof TOOL_RESULT_VERSION;
  usage: { costUsd?: number };
  updates?: ToolOutput[];
} & (
  | { status: "success"; output: Output }
  | { status: "error"; output: null; error: string }
);

const hasEveToolReceipt = (value: unknown): boolean =>
  typeof value === "object" &&
  value !== null &&
  "kind" in value &&
  value.kind === "chatjs.tool-result";

/* oxlint-disable typescript/prefer-readonly-parameter-types -- Tool receipts preserve the exact mutable output and updates references returned by tools; deep readonly inputs cannot satisfy the existing mutable ToolResult contract without cloning. */
const createToolResult = <Output extends ToolOutput>(
  output: Output,
  costUsd: number | undefined,
  updates?: ToolOutput[]
): ToolResult<Output> => {
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
    version: TOOL_RESULT_VERSION,
  };
};
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-disable typescript/prefer-readonly-parameter-types, unicorn/no-null -- Error receipts preserve the caller's mutable updates reference and serialize null output in the existing discriminated wire schema. */
const createToolError = (
  costUsd: number | undefined,
  updates?: ToolOutput[]
): ToolResult<never> => ({
  // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing createToolResult(null, costUsd, updates) own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
  ...createToolResult(null, costUsd, updates),
  error: "The tool did not complete.",
  output: null,
  status: "error",
});
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (createToolError, createToolResult, hasEveToolReceipt, toolOutputSchema, toolResultSchema); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable typescript/prefer-readonly-parameter-types, unicorn/no-null */
export {
  createToolError,
  createToolResult,
  hasEveToolReceipt,
  toolOutputSchema,
  toolResultSchema,
};
/* oxlint-enable import/no-named-export */
/* oxlint-disable import/no-named-export -- Keep the named type bindings (ToolOutput, ToolResult); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export type { ToolOutput, ToolResult };
/* oxlint-enable import/no-named-export */
