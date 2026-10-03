/* oxlint-disable sort-imports --
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
import { z } from "zod";

import { readGuestCredential } from "./disposable-guest";
import { safeStreamQuery } from "./request-policy";
/* oxlint-enable sort-imports */

/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): message uses 1, 16_000 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 */
const message = z
  .object({ message: z.string().trim().min(1).max(16_000) })
  .strict();
/* oxlint-enable no-magic-numbers */
/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): cancel uses 1, 200 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 */
const cancel = z
  .object({ turnId: z.string().min(1).max(200).optional() })
  .strict();
/* oxlint-enable no-magic-numbers */

/* oxlint-disable import/no-named-export, import/prefer-default-export, init-declarations, jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, max-statements, no-magic-numbers, no-ternary, oxc/no-async-await, oxc/no-optional-chaining, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null --
 * import/no-named-export (#527): Preserve the named authenticateDisposableGuest API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * import/prefer-default-export (#532): authenticateDisposableGuest remains a named API, consistent with no-default-export; adding future exports must not change caller import syntax.
 * init-declarations (#507): authenticateDisposableGuest assigns these bindings along its control-flow paths; eager undefined initialization would conflict with no-undefined and obscure definite assignment.
 * jsdoc/require-param (#534): authenticateDisposableGuest's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): authenticateDisposableGuest's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * max-lines-per-function (#510): authenticateDisposableGuest keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): authenticateDisposableGuest keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): authenticateDisposableGuest uses 7 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * no-ternary (#518): authenticateDisposableGuest derives branch values with conditional expressions; the enabled prefer-ternary rule also favors this form over assignment-only if statements.
 * oxc/no-async-await (#540): authenticateDisposableGuest sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * oxc/no-optional-chaining (#542): authenticateDisposableGuest handles optional authorization?.startsWith("Bearer ") without repeated reads; expanding guards requires preserving missing-value and evaluation semantics.
 * typescript/explicit-function-return-type (#560): Keep authenticateDisposableGuest's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep authenticateDisposableGuest's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): authenticateDisposableGuest accepts request: Request; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): authenticateDisposableGuest intentionally keeps the existing falsy-value behavior of authorization?.startsWith("Bearer "); claims.sessionId; distinguishing empty, zero, and absent states requires a domain behavior decision.
 * unicorn/no-null (#570): authenticateDisposableGuest preserves explicit null in its storage/API state; undefined has different serialization and presence semantics.
 */
/** EVE's stream route delegates ownership checks to channel auth. Bind every
 * permitted operation to the exact server-issued session credential. */
export const authenticateDisposableGuest = async (request: Request) => {
  const authorization = request.headers.get("authorization");
  const claims = readGuestCredential(
    authorization?.startsWith("Bearer ") ? authorization.slice(7) : null
  );
  if (!claims) {
    return null;
  }
  const url = new URL(request.url);
  let body: z.ZodType | undefined;
  if (claims.sessionId) {
    const path = `/eve/v1/session/${claims.sessionId}`;
    if (request.method === "GET" && url.pathname === `${path}/stream`) {
      if (!safeStreamQuery(url.searchParams)) {
        return null;
      }
    } else if (request.method === "POST" && url.pathname === path) {
      body = message;
    } else if (request.method === "POST" && url.pathname === `${path}/cancel`) {
      body = cancel;
    } else if (request.method === "POST" && url.pathname === `${path}/reset`) {
      body = z.object({}).strict();
    } else {
      return null;
    }
  } else {
    if (request.method !== "POST" || url.pathname !== "/eve/v1/session") {
      return null;
    }
    // Creation credentials stay on the server and cannot seed, fork or send.
    body = z.object({}).strict();
  }
  if (
    body &&
    !body.safeParse(
      await request
        .clone()
        .json()
        .catch(() => null)
    ).success
  ) {
    return null;
  }
  return {
    attributes: { modelId: claims.modelId },
    authenticator: "chatjs-disposable-guest",
    issuer: "chatjs",
    principalId: claims.ownerId,
    principalType: "user" as const,
    subject: claims.ownerId,
  };
};
/* oxlint-enable import/no-named-export, import/prefer-default-export, init-declarations, jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, max-statements, no-magic-numbers, no-ternary, oxc/no-async-await, oxc/no-optional-chaining, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null */
