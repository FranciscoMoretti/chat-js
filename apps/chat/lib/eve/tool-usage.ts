import type { ToolContext } from "eve/tools";

/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { ToolOutput, ToolResult } from "./tool-result";
/* oxlint-enable sort-imports */
import { createToolError, createToolResult } from "./tool-result";

/** Only an explicitly reported domain failure becomes an error receipt. */
class ExpectedToolFailureError extends Error {
  public override name = "ExpectedToolFailureError";
}

/* oxlint-disable jsdoc/require-returns, no-magic-numbers, no-undefined, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types -- jsdoc/require-returns (#535): createToolUsage's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
no-magic-numbers (#517): createToolUsage uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
no-undefined (#519): createToolUsage uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
typescript/explicit-function-return-type (#560): Keep createToolUsage's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
typescript/explicit-module-boundary-types (#562): Keep createToolUsage's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary. */
/** Unknown pricing is sticky: a known subtotal must never masquerade as a complete charge. */
const createToolUsage = () => {
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
    /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve totalUsd's awaited sequencing and rejected-Promise behavior. */
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
    /* oxlint-enable oxc/no-async-await */
  };
};
/* oxlint-enable jsdoc/require-returns, no-magic-numbers, no-undefined, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types */
type ToolUsage = ReturnType<typeof createToolUsage>;

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve executeWithToolUsage's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable id-length, max-statements, typescript/prefer-readonly-parameter-types -- id-length (#506): executeWithToolUsage uses T as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology.
max-statements (#512): executeWithToolUsage keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
typescript/prefer-readonly-parameter-types (#565): executeWithToolUsage accepts context: Pick<ToolContext, "abortSignal">; usage: ToolUsage; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration. */
const executeWithToolUsage = async <T extends ToolOutput>(
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern targets support async iteration and native async callbacks; preserve asynchronous iteration, awaited sequencing, and rejection behavior in executeWithToolProgress. executeWithToolProgress returns AsyncGenerator<ToolResult<T>> and yield-delegates to ReadableStream asynchronous iteration; deleting async yields the wrong iterator protocol. */
/* oxlint-enable id-length, max-statements, typescript/prefer-readonly-parameter-types */

/* oxlint-disable id-length, init-declarations, jsdoc/require-param, no-undefined, typescript/prefer-readonly-parameter-types -- id-length (#506): executeWithToolProgress uses T as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology.
init-declarations (#507): executeWithToolProgress assigns these bindings along its control-flow paths; eager undefined initialization would conflict with no-undefined and obscure definite assignment.
jsdoc/require-param (#534): executeWithToolProgress's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
no-undefined (#519): executeWithToolProgress uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
typescript/prefer-readonly-parameter-types (#565): executeWithToolProgress accepts context: Pick<ToolContext, "abortSignal">; options: { usage: ToolUsage; abortSignal: AbortSignal; publish: (output: T, updates?:; updates?: ToolOutput[]; controller; nextUpdates?: ToolOutput[]; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration. */
/** Streaming alone needs a queue; accounting is shared.
 * @yields {object} Progress snapshots followed by the final usage receipt.
 */
const executeWithToolProgress = async function* executeWithToolProgress<
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
        // oxlint-disable-next-line typescript/promise-function-async -- Forward the executor promise unchanged; synchronous executor failures stay inside executeWithToolUsage's existing try/catch.
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
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (createToolUsage, executeWithToolProgress, executeWithToolUsage); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable id-length, init-declarations, jsdoc/require-param, no-undefined, typescript/prefer-readonly-parameter-types */
export { createToolUsage, executeWithToolProgress, executeWithToolUsage };
/* oxlint-enable import/no-named-export */
/* oxlint-disable import/no-named-export -- Keep the named type bindings (ToolUsage); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export type { ToolUsage };
/* oxlint-enable import/no-named-export */
