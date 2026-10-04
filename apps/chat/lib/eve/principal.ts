import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";

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

/* oxlint-disable unicorn/no-null -- * unicorn/no-null (#570): resolveEvePrincipal preserves explicit null in its storage/API state; undefined has different serialization and presence semantics. */
/** Disposable guests never enter application ownership, billing, or history routes.
 * Old guest cookies grant no access.
 * @param headers - Request headers passed to the registered-session lookup.
 * @returns Registered session ownership, or no principal when the session is absent.
 */
export const resolveEvePrincipal = async (
  headers: ReadonlyNativeSurface<Headers>
): Promise<EvePrincipal | null> => {
  const session = await auth.api.getSession({ headers });
  return session?.user
    ? { kind: "registered", ownerId: session.user.id }
    : null;
};
/* oxlint-enable unicorn/no-null */
