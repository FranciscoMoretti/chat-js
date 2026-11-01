import type { ToolContext } from "eve/tools";

import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";

import type { ToolOutput, ToolResult } from "./tool-result";
import { createToolError, createToolResult } from "./tool-result";

/** Only an explicitly reported domain failure becomes an error receipt. */
class ExpectedToolFailureError extends Error {
  public override name = "ExpectedToolFailureError";
}

/** Unknown pricing is sticky: a known subtotal must never masquerade as a complete charge.
 * @returns {ToolUsage} An accounting session whose incomplete/failed charges keep the settled total absent, and whose explicit fail method produces a domain error receipt.
 */
const createToolUsage = (): {
  addCostUsd: (cost: number) => void;
  addDeferredCost: (resolve: () => Promise<number>) => void;
  fail: () => never;
  markUnknown: () => void;
  totalUsd: () => Promise<number | undefined>;
} => {
  let reported = false;
  let unknown = false;
  let total = 0;
  const pending: (() => Promise<number>)[] = [];
  const addCostUsd = (cost: number): void => {
    if (!Number.isFinite(cost) || cost < 0 || !Number.isFinite(total + cost)) {
      unknown = true;
      throw new Error("Tool cost must be finite and nonnegative.");
    }
    reported = true;
    total += cost;
  };
  return {
    addCostUsd,
    addDeferredCost: (resolve: () => Promise<number>): void => {
      pending.push(resolve);
    },
    fail: (): never => {
      throw new ExpectedToolFailureError("The tool did not complete.");
    },
    markUnknown: (): void => {
      unknown = true;
    },
    async totalUsd(): Promise<number | undefined> {
      await Promise.all(
        pending.splice(0).map(async (resolve) => {
          try {
            addCostUsd(await resolve());
          } catch {
            unknown = true;
          }
        })
      );
      if (reported && !unknown) {
        return total;
      }
      return undefined;
    },
  };
};

type ToolUsage = ReturnType<typeof createToolUsage>;
type ToolProgressOptions<Output extends ToolOutput> = ReadonlyNativeSurface<{
  usage: ToolUsage;
  abortSignal: AbortSignal;
  publish: (output: Output, updates?: readonly ToolOutput[]) => void;
}>;

const executeWithToolUsage = async <Output extends ToolOutput>(
  context: ReadonlyNativeSurface<Pick<ToolContext, "abortSignal">>,
  execute: (usage: ReadonlyNativeSurface<ToolUsage>) => Output | Promise<Output>
): Promise<ToolResult<Output>> => {
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
      if (error instanceof Error) {
        throw error;
      }
      // Provider rejection values are diagnostics, not domain receipts or control flow.
      throw new Error("Unexpected tool failure.", { cause: error });
    }
    const costUsd = await usage.totalUsd();
    context.abortSignal.throwIfAborted();
    return createToolError(costUsd);
  }
};

/** Streaming alone needs a queue; accounting is shared.
 * @param {ReadonlyNativeSurface<Pick<ToolContext, "abortSignal">>} context Native cancellation capability checked before execution and while settling usage.
 * @param {(options: ReadonlyNativeSurface<{usage: ToolUsage; abortSignal: AbortSignal; publish: (output: Output, updates?: readonly ToolOutput[]) => void}>) => Promise<Output>} execute Executor that publishes exact output/update references and resolves the final result under the provided usage/cancellation session.
 * @yields {ToolResult<Output>} Progress snapshots followed by the final settled usage receipt.
 */
const executeWithToolProgress = async function* executeWithToolProgress<
  Output extends ToolOutput,
>(
  context: ReadonlyNativeSurface<Pick<ToolContext, "abortSignal">>,
  execute: (options: ToolProgressOptions<Output>) => Promise<Output>
): AsyncGenerator<ToolResult<Output>, void> {
  context.abortSignal.throwIfAborted();
  const cancellation = new AbortController();
  const abortSignal = AbortSignal.any([
    context.abortSignal,
    cancellation.signal,
  ]);
  let updates: readonly ToolOutput[] | undefined;
  let cancelled = false;
  const stream = new ReadableStream<ToolResult<Output>>({
    cancel(): void {
      cancelled = true;
      cancellation.abort();
    },
    async start(
      controller: Readonly<ReadableStreamDefaultController<ToolResult<Output>>>
    ): Promise<void> {
      const publish = (
        output: Output,
        nextUpdates?: readonly ToolOutput[]
      ): void => {
        updates = nextUpdates;
        if (!cancelled) {
          controller.enqueue(createToolResult(output, undefined, updates));
        }
      };
      try {
        const result = await executeWithToolUsage(
          { abortSignal },
          async (usage) => await execute({ abortSignal, publish, usage })
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
export { createToolUsage, executeWithToolProgress, executeWithToolUsage };
export type { ToolUsage };
