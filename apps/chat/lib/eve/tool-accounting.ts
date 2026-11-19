import { defineTool } from "eve/tools";
import type { ToolDefinition } from "eve/tools";
import type { ToolOutput, ToolResult } from "./tool-result";
import { createToolResult } from "./tool-result";
import { toolResultToModelOutput } from "./tool-model-output";

type AccountingPolicy = "none" | "unknown" | { readonly costUsd: number };

const isStream = <Output>(
  output: Output | AsyncIterable<Output>
): output is AsyncIterable<Output> =>
  typeof output === "object" &&
  output !== null &&
  Symbol.asyncIterator in output;

/** Wrap native snapshots once; only successful completion settles a charge.
 * Unknown provider pricing must never be reported as a zero-cost receipt.
 */
export const withToolAccounting = <Input, Output extends ToolOutput>(
  definition: ToolDefinition<Input, Output>,
  policy: AccountingPolicy
): ToolDefinition<Input, ToolResult<Output>> => {
  const costUsd = typeof policy === "object" ? policy.costUsd : undefined;
  const settledCostUsd = policy === "none" ? 0 : costUsd;
  if (costUsd !== undefined && (!Number.isFinite(costUsd) || costUsd < 0)) {
    throw new Error("Tool cost must be finite and nonnegative.");
  }
  const {
    outputSchema: _outputSchema,
    toModelOutput,
    label,
    endsTurn,
    ...options
  } = definition;
  return defineTool<Input, ToolResult<Output>>({
    ...options,
    async *execute(input, context) {
      context.abortSignal.throwIfAborted();
      const result = await definition.execute(input, context);
      if (isStream(result)) {
        let final: { output: Output } | undefined;
        for await (const output of result) {
          context.abortSignal.throwIfAborted();
          final = { output };
          yield createToolResult(output);
        }
        context.abortSignal.throwIfAborted();
        if (!final) {
          throw new Error("Native tool completed without an output snapshot.");
        }
        yield createToolResult(final.output, settledCostUsd);
      } else {
        context.abortSignal.throwIfAborted();
        yield createToolResult(result, settledCostUsd);
      }
    },
    toModelOutput: async (result) =>
      result.status === "success" && toModelOutput
        ? await toModelOutput(result.output)
        : toolResultToModelOutput(result),
    endsTurn:
      typeof endsTurn === "function"
        ? async (result) =>
            result.status === "success" && (await endsTurn(result.output))
        : endsTurn,
    label:
      label !== undefined && label !== false
        ? {
            start: (input) => label.start(input),
            ...(label.delta
              ? {
                  delta: (
                    input: Readonly<Input>,
                    result: Readonly<ToolResult<Output>>
                  ) =>
                    result.status === "success"
                      ? (label.delta?.(input, result.output) ??
                        label.start(input))
                      : label.start(input),
                }
              : {}),
            ...(label.complete
              ? {
                  complete: (
                    input: Readonly<Input>,
                    result: Readonly<ToolResult<Output>>
                  ) =>
                    result.status === "success"
                      ? (label.complete?.(input, result.output) ??
                        label.start(input))
                      : label.start(input),
                }
              : {}),
          }
        : label,
  });
};
