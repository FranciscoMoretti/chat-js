/* oxlint-disable import/no-relative-parent-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../auth" dependency within this package instead of introducing an alias or barrel API.
 */
import { auth } from "../auth";
/* oxlint-enable import/no-relative-parent-imports */

/* oxlint-disable import/no-named-export --
 * import/no-named-export (#527): Preserve the named EvePrincipal API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 */
export type EvePrincipal =
  | { kind: "registered"; ownerId: string }
  | {
      kind: "guest";
      ownerId: string;
      tokenHash: string;
      state: "pending" | "active";
      remainingMessages?: number;
    };
/* oxlint-enable import/no-named-export */

/* oxlint-disable import/no-named-export, jsdoc/require-param, jsdoc/require-returns, no-ternary, oxc/no-async-await, oxc/no-optional-chaining, typescript/prefer-readonly-parameter-types, unicorn/no-null --
 * import/no-named-export (#527): Preserve the named resolveEvePrincipal API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * jsdoc/require-param (#534): resolveEvePrincipal's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): resolveEvePrincipal's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * no-ternary (#518): resolveEvePrincipal derives branch values with conditional expressions; the enabled prefer-ternary rule also favors this form over assignment-only if statements.
 * oxc/no-async-await (#540): resolveEvePrincipal sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * oxc/no-optional-chaining (#542): resolveEvePrincipal handles optional session?.user without repeated reads; expanding guards requires preserving missing-value and evaluation semantics.
 * typescript/prefer-readonly-parameter-types (#565): resolveEvePrincipal accepts headers: Headers; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * unicorn/no-null (#570): resolveEvePrincipal preserves explicit null in its storage/API state; undefined has different serialization and presence semantics.
 */
/** Disposable guests never enter application ownership, billing, or history routes.
 * Old guest cookies grant no access. */
export const resolveEvePrincipal = async (
  headers: Headers
): Promise<EvePrincipal | null> => {
  const session = await auth.api.getSession({ headers });
  return session?.user
    ? { kind: "registered", ownerId: session.user.id }
    : null;
};
/* oxlint-enable import/no-named-export, jsdoc/require-param, jsdoc/require-returns, no-ternary, oxc/no-async-await, oxc/no-optional-chaining, typescript/prefer-readonly-parameter-types, unicorn/no-null */
