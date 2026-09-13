import { env } from "@/lib/env";
import { isEveEnabled } from "@/lib/eve/availability";
import {
  createEveGuestCredential,
  eveGuestOwnerId,
} from "@/lib/eve/guest-credential";
import { EVE_GUEST_COOKIE, resolveEvePrincipal } from "@/lib/eve/principal";
import { sameOrigin } from "@/lib/eve/request-policy";
import { ANONYMOUS_LIMITS } from "@/lib/types/anonymous";

/** Bootstrap only: no account row, message admission, or monetary credit is created. */
export const POST = async (request: Request) => {
  if (!isEveEnabled()) {
    return new Response(null, { status: 404 });
  }
  if (!sameOrigin(request, new URL(env.APP_URL ?? request.url).origin)) {
    return new Response(null, { status: 403 });
  }
  const principal = await resolveEvePrincipal(request.headers);
  const headers = new Headers({ "cache-control": "no-store" });
  if (principal) {
    return Response.json(
      { kind: principal.kind, ownerId: principal.ownerId },
      { headers }
    );
  }
  const credential = createEveGuestCredential();
  const secure = env.NODE_ENV === "production" ? "; Secure" : "";
  headers.set(
    "set-cookie",
    `${EVE_GUEST_COOKIE}=${credential.token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(ANONYMOUS_LIMITS.SESSION_DURATION / 1000)}${secure}`
  );
  return Response.json(
    { kind: "guest", ownerId: eveGuestOwnerId(credential.tokenHash) },
    { headers }
  );
};
