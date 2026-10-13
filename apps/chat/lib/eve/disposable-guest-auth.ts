import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import { readGuestCredential } from "./disposable-guest";
import { safeStreamQuery } from "./request-policy";
import { z } from "zod";

const MIN_FIELD_LENGTH = 1;
const MAX_MESSAGE_LENGTH = 16_000;
const MAX_TURN_ID_LENGTH = 200;
const BEARER_PREFIX = "Bearer ";

const message = z
  .object({
    message: z.string().trim().min(MIN_FIELD_LENGTH).max(MAX_MESSAGE_LENGTH),
  })
  .strict();

const cancel = z
  .object({
    turnId: z.string().min(MIN_FIELD_LENGTH).max(MAX_TURN_ID_LENGTH).optional(),
  })
  .strict();

/** EVE's stream route delegates ownership checks to channel auth. Bind every
 * permitted operation to the exact server-issued session credential.
 * @param {ReadonlyNativeSurface<Request>} request - Native operation request whose credential, path and body are checked.
 * @returns {Promise<{ attributes: { modelId: string }; authenticator: string; issuer: string; principalId: string; principalType: "user"; subject: string; } | null>} Session-bound channel identity, or no identity for an invalid credential or operation.
 */
export const authenticateDisposableGuest = async (
  request: ReadonlyNativeSurface<Request>
): Promise<{
  attributes: { modelId: string };
  authenticator: string;
  issuer: string;
  principalId: string;
  principalType: "user";
  subject: string;
} | null> => {
  const authorization = request.headers.get("authorization") ?? "";
  const claims = readGuestCredential(
    authorization.startsWith(BEARER_PREFIX)
      ? authorization.slice(BEARER_PREFIX.length)
      : null
  );
  if (!claims) {
    return null;
  }
  const url = new URL(request.url);
  let body: z.ZodType | undefined;
  if (typeof claims.sessionId === "string" && claims.sessionId !== "") {
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
