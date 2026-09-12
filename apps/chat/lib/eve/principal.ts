import { auth } from "../auth";
import { readEveGuestCredential } from "../db/eve-guests";
import { eveGuestOwnerId, hashEveGuestToken } from "./guest-credential";

export const EVE_GUEST_COOKIE = "chatjs-eve-guest";

export type EvePrincipal =
  | { kind: "registered"; ownerId: string }
  | {
      kind: "guest";
      ownerId: string;
      tokenHash: string;
      state: "pending" | "active";
      remainingMessages?: number;
    };

/** Cookie-only guest identity never creates a BetterAuth session or transfers history. */
export async function resolveEvePrincipal(
  headers: Headers
): Promise<EvePrincipal | null> {
  const session = await auth.api.getSession({ headers });
  if (session?.user) {
    return { kind: "registered", ownerId: session.user.id };
  }
  const tokens = (headers.get("cookie") ?? "")
    .split(";")
    .map((cookie) => cookie.trim())
    .filter((cookie) => cookie.startsWith(`${EVE_GUEST_COOKIE}=`))
    .map((cookie) => cookie.slice(EVE_GUEST_COOKIE.length + 1));
  if (tokens.length !== 1) {
    return null;
  }
  const tokenHash = hashEveGuestToken(tokens[0]);
  if (!tokenHash) {
    return null;
  }
  const identity = await readEveGuestCredential(tokenHash);
  if (identity.status === "expired" || identity.status === "invalid") {
    return null;
  }
  const ownerId = eveGuestOwnerId(tokenHash);
  if (identity.status === "active") {
    if (identity.guest.ownerId !== ownerId) {
      return null;
    }
    return {
      kind: "guest",
      ownerId,
      tokenHash,
      state: "active",
      remainingMessages: identity.guest.remainingMessages,
    };
  }
  return { kind: "guest", ownerId, tokenHash, state: "pending" };
}
