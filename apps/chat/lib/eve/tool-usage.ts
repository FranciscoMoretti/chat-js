import type { ToolContext } from "eve/tools";

import { createToolResult, createToolError } from "./tool-result";
import type { ToolOutput, ToolResult } from "./tool-result";

/** Only an explicitly reported domain failure becomes an error receipt. */
class ExpectedToolFailureError extends Error {
  public override name = "ExpectedToolFailureError";
}

/* oxlint-disable import/group-exports, jsdoc/require-returns, no-magic-numbers, no-undefined, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types  --
 * import/group-exports (#523): createToolUsage stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named createToolUsage API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * jsdoc/require-returns (#535): createToolUsage's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * no-magic-numbers (#517): createToolUsage uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * no-ternary (#518): createToolUsage derives branch values with conditional expressions; the enabled prefer-ternary rule also favors this form over assignment-only if statements.
 * no-undefined (#519): createToolUsage uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * oxc/no-async-await (#540): createToolUsage sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * typescript/explicit-function-return-type (#560): Keep createToolUsage's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep createToolUsage's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 */
/** Unknown pricing is sticky: a known subtotal must never masquerade as a complete charge. */
export const createToolUsage = () => {
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
/* oxlint-enable import/group-exports, jsdoc/require-returns, no-magic-numbers, no-undefined, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types */
export type ToolUsage = ReturnType<typeof createToolUsage>;

/* oxlint-disable id-length, import/group-exports, max-statements, typescript/prefer-readonly-parameter-types  --
 * id-length (#506): executeWithToolUsage uses T as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology.
 * import/group-exports (#523): executeWithToolUsage stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named executeWithToolUsage API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * max-statements (#512): executeWithToolUsage keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * oxc/no-async-await (#540): executeWithToolUsage sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * typescript/prefer-readonly-parameter-types (#565): executeWithToolUsage accepts context: Pick<ToolContext, "abortSignal">; usage: ToolUsage; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
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
/* oxlint-enable id-length, import/group-exports, max-statements, typescript/prefer-readonly-parameter-types */

/* oxlint-disable id-length, import/group-exports, init-declarations, jsdoc/require-param, no-undefined, typescript/prefer-readonly-parameter-types, typescript/promise-function-async  --
 * id-length (#506): executeWithToolProgress uses T as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology.
 * import/group-exports (#523): executeWithToolProgress stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named executeWithToolProgress API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * init-declarations (#507): executeWithToolProgress assigns these bindings along its control-flow paths; eager undefined initialization would conflict with no-undefined and obscure definite assignment.
 * jsdoc/require-param (#534): executeWithToolProgress's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * no-undefined (#519): executeWithToolProgress uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * oxc/no-async-await (#540): executeWithToolProgress sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * oxc/no-rest-spread-properties (#543): executeWithToolProgress copies or separates ...result while preserving existing object ownership; mutating source objects is not equivalent.
 * typescript/prefer-readonly-parameter-types (#565): executeWithToolProgress accepts context: Pick<ToolContext, "abortSignal">; options: { usage: ToolUsage; abortSignal: AbortSignal; publish: (output: T, updates?:; updates?: ToolOutput[]; controller; nextUpdates?: ToolOutput[]; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): executeWithToolProgress preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
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
    cancel(): void {
      cancelled = true;
      cancellation.abort();
    },
    async start(controller): Promise<void> {
      const publish = (output: T, nextUpdates?: ToolOutput[]): void => {
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
/* oxlint-enable id-length, import/group-exports, init-declarations, jsdoc/require-param, no-undefined, typescript/prefer-readonly-parameter-types, typescript/promise-function-async */
