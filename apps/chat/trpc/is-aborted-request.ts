import { TRPCClientError } from "@trpc/client";

/**
 * An intentionally cancelled transport is not an application failure.
 * @param {unknown} result - Transport result or thrown value to classify.
 * @returns {boolean} Whether this is a native tRPC client error whose cause is named AbortError.
 */
export const isAbortedRequest = (result: unknown): boolean =>
  result instanceof TRPCClientError && result.cause?.name === "AbortError";
