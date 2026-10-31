import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import { auth } from "@/lib/auth";

export interface EvePrincipal {
  kind: "registered";
  ownerId: string;
}

/** Disposable guests never enter application ownership, billing, or history routes.
 * Old guest cookies grant no access.
 * @param {ReadonlyNativeSurface<Headers>} headers - Request headers passed to the registered-session lookup.
 * @returns {Promise<EvePrincipal | null>} Registered session ownership, or no principal when the session is absent.
 */
export const resolveEvePrincipal = async (
  headers: ReadonlyNativeSurface<Headers>
): Promise<EvePrincipal | null> => {
  const session = await auth.api.getSession({ headers });

  if (session?.user) {
    return { kind: "registered", ownerId: session.user.id };
  }
  return null;
};
