import { TRPCClientError } from "@trpc/client";

/* oxlint-disable jsdoc/require-param, jsdoc/require-returns --
 * jsdoc/require-param (#534): isAbortedRequest's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): isAbortedRequest's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 */
/** An intentionally cancelled transport is not an application failure. */
export const isAbortedRequest = (result: unknown): boolean =>
  result instanceof TRPCClientError && result.cause?.name === "AbortError";
/* oxlint-enable jsdoc/require-param, jsdoc/require-returns */
