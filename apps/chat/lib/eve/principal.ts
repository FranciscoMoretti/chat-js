/* oxlint-disable import/no-relative-parent-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../auth" dependency within this package instead of introducing an alias or barrel API.
 */
import { auth } from "../auth";
/* oxlint-enable import/no-relative-parent-imports */

export type EvePrincipal =
  | { kind: "registered"; ownerId: string }
  | {
      kind: "guest";
      ownerId: string;
      tokenHash: string;
      state: "pending" | "active";
      remainingMessages?: number;
    };

/* oxlint-disable jsdoc/require-param, jsdoc/require-returns, typescript/prefer-readonly-parameter-types, unicorn/no-null --
 * jsdoc/require-param (#534): resolveEvePrincipal's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): resolveEvePrincipal's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
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
/* oxlint-enable jsdoc/require-param, jsdoc/require-returns, typescript/prefer-readonly-parameter-types, unicorn/no-null */
