import { TRPCClientError } from "@trpc/client";

/* oxlint-disable jsdoc/require-param, jsdoc/require-returns  --
 * import/no-named-export (#527): Preserve the named isAbortedRequest API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * import/prefer-default-export (#532): isAbortedRequest remains a named API, consistent with no-default-export; adding future exports must not change caller import syntax.
 * jsdoc/require-param (#534): isAbortedRequest's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): isAbortedRequest's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * oxc/no-optional-chaining (#542): isAbortedRequest handles optional result.cause?.name without repeated reads; expanding guards requires preserving missing-value and evaluation semantics.
 */
/** An intentionally cancelled transport is not an application failure. */
export const isAbortedRequest = (result: unknown): boolean =>
  result instanceof TRPCClientError && result.cause?.name === "AbortError";
/* oxlint-enable jsdoc/require-param, jsdoc/require-returns */
