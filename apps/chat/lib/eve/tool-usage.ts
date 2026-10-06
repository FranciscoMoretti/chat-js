import type { ToolContext } from "eve/tools";

/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";

import type { ToolOutput, ToolResult } from "./tool-result";
/* oxlint-enable sort-imports */
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
    // oxlint-disable-next-line no-magic-numbers -- Negative charges are invalid; zero remains a valid explicitly reported cost.
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
    /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve totalUsd's awaited sequencing and rejected-Promise behavior. */
    async totalUsd(): Promise<number | undefined> {
      await Promise.all(
        // oxlint-disable-next-line no-magic-numbers -- Drain all currently queued deferred charges; later additions remain for the next settlement.
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
      // oxlint-disable-next-line no-undefined -- Missing or incomplete billing evidence must remain an absent total, never a free charge.
      return undefined;
    },
    /* oxlint-enable oxc/no-async-await */
  };
};

type ToolUsage = ReturnType<typeof createToolUsage>;
type ToolProgressOptions<Output extends ToolOutput> = ReadonlyNativeSurface<{
  usage: ToolUsage;
  abortSignal: AbortSignal;
  publish: (output: Output, updates?: readonly ToolOutput[]) => void;
}>;

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve executeWithToolUsage's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable max-statements --max-statements (#512): Check cancellation before execution, after cost settlement and again when converting only ExpectedToolFailureError into an error receipt; unknown failures remain rejected. Preserve these billing/cancellation boundaries.*/
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
      throw error;
    }
    const costUsd = await usage.totalUsd();
    context.abortSignal.throwIfAborted();
    return createToolError(costUsd);
  }
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern targets support async iteration and native async callbacks; preserve asynchronous iteration, awaited sequencing, and rejection behavior in executeWithToolProgress. executeWithToolProgress returns AsyncGenerator<ToolResult<Output>> and yield-delegates to ReadableStream asynchronous iteration; deleting async yields the wrong iterator protocol. */
/* oxlint-enable max-statements */

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
): AsyncGenerator<ToolResult<Output>> {
  context.abortSignal.throwIfAborted();
  const cancellation = new AbortController();
  const abortSignal = AbortSignal.any([
    context.abortSignal,
    cancellation.signal,
  ]);
  // oxlint-disable-next-line init-declarations -- Updates are absent until the executor publishes them; explicit undefined initialization conflicts with no-undefined and adds an unnecessary write.
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
          controller.enqueue(createToolResult(output, undefined, updates)); // oxlint-disable-line no-undefined -- Progress has no settled cost receipt yet; undefined preserves that existing absence contract.
        }
      };
      try {
        // oxlint-disable-next-line typescript/promise-function-async -- Forward the executor promise unchanged; synchronous executor failures stay inside executeWithToolUsage's existing try/catch.
        const result = await executeWithToolUsage({ abortSignal }, (usage) =>
          execute({ abortSignal, publish, usage })
        );
        if (!cancelled) {
          // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing result own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
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
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (createToolUsage, executeWithToolProgress, executeWithToolUsage); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable oxc/no-async-await */
export { createToolUsage, executeWithToolProgress, executeWithToolUsage };
/* oxlint-enable import/no-named-export */
/* oxlint-disable import/no-named-export -- Keep the named type bindings (ToolUsage); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export type { ToolUsage };
/* oxlint-enable import/no-named-export */
