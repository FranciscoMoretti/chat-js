import { z } from "zod";

import { readGuestCredential } from "./disposable-guest";
import { safeStreamQuery } from "./request-policy";

const message = z
  .object({ message: z.string().trim().min(1).max(16_000) })
  .strict();
const cancel = z
  .object({ turnId: z.string().min(1).max(200).optional() })
  .strict();

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
