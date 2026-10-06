import { TRPCClientError } from "@trpc/client";

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (isAbortedRequest); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/**
 * An intentionally cancelled transport is not an application failure.
 * @param {unknown} result - Transport result or thrown value to classify.
 * @returns {boolean} Whether this is a native tRPC client error whose cause is named AbortError.
 */
export const isAbortedRequest = (result: unknown): boolean =>
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading name from result.cause; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
  result instanceof TRPCClientError && result.cause?.name === "AbortError";
/* oxlint-enable import/prefer-default-export, import/no-named-export */
