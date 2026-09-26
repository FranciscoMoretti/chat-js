import { TRPCClientError } from "@trpc/client";

/** An intentionally cancelled transport is not an application failure. */
export const isAbortedRequest = (result: unknown) =>
  result instanceof TRPCClientError && result.cause?.name === "AbortError";
