import { auth } from "../auth";

export type EvePrincipal =
  | { kind: "registered"; ownerId: string }
  | {
      kind: "guest";
      ownerId: string;
      tokenHash: string;
      state: "pending" | "active";
      remainingMessages?: number;
    };

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
