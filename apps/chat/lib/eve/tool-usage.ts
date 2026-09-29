import type { ToolContext } from "eve/tools";

import { createToolResult, createToolError } from "./tool-result";
import type { ToolOutput, ToolResult } from "./tool-result";

/** Only an explicitly reported domain failure becomes an error receipt. */
class ExpectedToolFailureError extends Error {
  override name = "ExpectedToolFailureError";
}

/** Unknown pricing is sticky: a known subtotal must never masquerade as a complete charge. */
export const createToolUsage = () => {
  let reported = false;
  let unknown = false;
  let total = 0;
  const pending: (() => Promise<number>)[] = [];
  const addCostUsd = (cost: number) => {
    if (!Number.isFinite(cost) || cost < 0 || !Number.isFinite(total + cost)) {
      unknown = true;
      throw new Error("Tool cost must be finite and nonnegative.");
    }
    reported = true;
    total += cost;
  };
  return {
    addCostUsd,
    addDeferredCost: (resolve: () => Promise<number>) => {
      pending.push(resolve);
    },
    fail: (): never => {
      throw new ExpectedToolFailureError("The tool did not complete.");
    },
    markUnknown: () => {
      unknown = true;
    },
    async totalUsd() {
      await Promise.all(
        pending.splice(0).map(async (resolve) => {
          try {
            addCostUsd(await resolve());
          } catch {
            unknown = true;
          }
        })
      );
      return reported && !unknown ? total : undefined;
    },
  };
};
export type ToolUsage = ReturnType<typeof createToolUsage>;

export const executeWithToolUsage = async <T extends ToolOutput>(
  context: Pick<ToolContext, "abortSignal">,
  execute: (usage: ToolUsage) => T | Promise<T>
): Promise<ToolResult<T>> => {
  context.abortSignal.throwIfAborted();
  const usage = createToolUsage();
  try {
    const output = await execute(usage);
    const costUsd = await usage.totalUsd();
    context.abortSignal.throwIfAborted();
    return createToolResult(output, costUsd);
  } catch (error) {
    context.abortSignal.throwIfAborted();
    if (!(error instanceof ExpectedToolFailureError)) {
      throw error;
    }
    const costUsd = await usage.totalUsd();
    context.abortSignal.throwIfAborted();
    return createToolError(costUsd);
  }
};

/** Streaming alone needs a queue; accounting is shared.
 * @yields {object} Progress snapshots followed by the final usage receipt.
 */
export const executeWithToolProgress = async function* executeWithToolProgress<
  T extends ToolOutput,
>(
  context: Pick<ToolContext, "abortSignal">,
  execute: (options: {
    usage: ToolUsage;
    abortSignal: AbortSignal;
    publish: (output: T, updates?: ToolOutput[]) => void;
  }) => Promise<T>
): AsyncGenerator<ToolResult<T>> {
  context.abortSignal.throwIfAborted();
  const cancellation = new AbortController();
  const abortSignal = AbortSignal.any([
    context.abortSignal,
    cancellation.signal,
  ]);
  let updates: ToolOutput[] | undefined;
  let cancelled = false;
  const stream = new ReadableStream<ToolResult<T>>({
    cancel() {
      cancelled = true;
      cancellation.abort();
    },
    async start(controller) {
      const publish = (output: T, nextUpdates?: ToolOutput[]) => {
        updates = nextUpdates;
        if (!cancelled) {
          controller.enqueue(createToolResult(output, undefined, updates));
        }
      };
      try {
        const result = await executeWithToolUsage({ abortSignal }, (usage) =>
          execute({ abortSignal, publish, usage })
        );
        if (!cancelled) {
          controller.enqueue({ ...result, updates });
          controller.close();
        }
      } catch (error) {
        if (!cancelled) {
          controller.error(error);
        }
      }
    },
  });
  yield* stream;
};
