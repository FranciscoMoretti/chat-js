import { z } from "zod";

/** JSON values, permitting optional object properties omitted by persistence. */
export type ToolOutput =
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
const base = z.object({
  kind: z.literal("chatjs.tool-result"),
  updates: z.array(jsonOutput).optional(),
  version: z.literal(1),
});
export const toolOutputSchema = z.discriminatedUnion("status", [
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
export const toolResultSchema = z.intersection(
  toolOutputSchema,
  z.object({ usage })
);
export type ToolResult<T extends ToolOutput> = {
  kind: "chatjs.tool-result";
  version: 1;
  usage: { costUsd?: number };
  updates?: ToolOutput[];
} & (
  | { status: "success"; output: T }
  | { status: "error"; output: null; error: string }
);

export const hasEveToolReceipt = (value: unknown) =>
  typeof value === "object" &&
  value !== null &&
  "kind" in value &&
  value.kind === "chatjs.tool-result";

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
export const createToolError = (
  costUsd: number | undefined,
  updates?: ToolOutput[]
): ToolResult<never> => ({
  ...createToolResult(null, costUsd, updates),
  error: "The tool did not complete.",
  output: null,
  status: "error",
});
