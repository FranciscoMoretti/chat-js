import { z } from "zod";

/** JSON values, permitting optional object properties omitted by persistence. */
type ToolOutput =
  | string
  | number
  | boolean
  | null
  | readonly ToolOutput[]
  | { readonly [key: string]: ToolOutput | undefined };

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
  readonly kind: "chatjs.tool-result";
  readonly version: typeof TOOL_RESULT_VERSION;
  readonly usage: { readonly costUsd?: number };
  readonly updates?: readonly ToolOutput[];
} & (
  | { readonly status: "success"; readonly output: Output }
  | { readonly status: "error"; readonly output: null; readonly error: string }
);

const hasEveToolReceipt = (value: unknown): boolean =>
  typeof value === "object" &&
  value !== null &&
  "kind" in value &&
  value.kind === "chatjs.tool-result";

const createToolResult = <Output extends ToolOutput>(
  output: Output,
  costUsd: number | undefined,
  updates?: readonly ToolOutput[]
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

const createToolError = (
  costUsd: number | undefined,
  updates?: readonly ToolOutput[]
): ToolResult<never> => ({
  ...createToolResult(null, costUsd, updates),
  error: "The tool did not complete.",
  output: null,
  status: "error",
});
export {
  createToolError,
  createToolResult,
  hasEveToolReceipt,
  toolOutputSchema,
  toolResultSchema,
};
export type { ToolOutput, ToolResult };
