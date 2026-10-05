import { auth } from "@/lib/auth";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
/* oxlint-disable import/no-named-export -- Keep the named type bindings (EvePrincipal); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable sort-imports */

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

/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (resolveEvePrincipal); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve resolveEvePrincipal's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable unicorn/no-null -- * unicorn/no-null (#570): resolveEvePrincipal preserves explicit null in its storage/API state; undefined has different serialization and presence semantics. */
/** Disposable guests never enter application ownership, billing, or history routes.
 * Old guest cookies grant no access.
 * @param {ReadonlyNativeSurface<Headers>} headers - Request headers passed to the registered-session lookup.
 * @returns {Promise<EvePrincipal | null>} Registered session ownership, or no principal when the session is absent.
 */
export const resolveEvePrincipal = async (
  headers: ReadonlyNativeSurface<Headers>
): Promise<EvePrincipal | null> => {
  const session = await auth.api.getSession({ headers });
  return session?.user
    ? { kind: "registered", ownerId: session.user.id }
    : null;
};
/* oxlint-enable import/no-named-export */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable unicorn/no-null */
