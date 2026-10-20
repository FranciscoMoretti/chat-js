import { readGuestBody } from "./guest-body";
import { GUEST_POLICY } from "./session-policy";
import {
  readGuestRuntimePolicy,
  reserveGuestRuntimeMessage,
} from "../db/guest-runtime";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import { readGuestCredential } from "./disposable-guest";
import { safeStreamQuery } from "./request-policy";
import { z } from "zod";

const MIN_FIELD_LENGTH = 1;
const MAX_MESSAGE_LENGTH = GUEST_POLICY.maxMessageCharacters;
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

type Claims = NonNullable<ReturnType<typeof readGuestCredential>>;

const guestOperation = (
  claims: Claims,
  url: URL,
  method: string
): { body?: z.ZodType; send?: boolean } | null => {
  if (claims.sessionId === undefined) {
    return method === "POST" && url.pathname === "/eve/v1/session"
      ? { body: z.object({ operationId: z.literal(claims.policyId) }).strict() }
      : null;
  }
  const path = `/eve/v1/session/${claims.sessionId}`;
  if (
    method === "GET" &&
    url.pathname === `${path}/stream` &&
    safeStreamQuery(url.searchParams)
  ) {
    return {};
  }
  if (method !== "POST") {
    return null;
  }
  if (url.pathname === `${path}/reset`) {
    return {
      body:
        claims.purpose === "cleanup"
          ? z
              .object({
                reason: z.literal("Guest retention expired").optional(),
              })
              .strict()
          : z.object({}).strict(),
    };
  }
  if (claims.purpose === "cleanup") {
    return null;
  }
  if (url.pathname === path) {
    return { body: message, send: true };
  }
  if (url.pathname === `${path}/cancel`) {
    return { body: cancel };
  }
  return null;
};

const policyMatches = (
  claims: Claims,
  policy: NonNullable<Awaited<ReturnType<typeof readGuestRuntimePolicy>>>
): boolean => {
  if (
    policy.modelId !== claims.modelId ||
    String(policy.policyVersion) !== GUEST_POLICY.version
  ) {
    return false;
  }
  if (policy.sessionId !== (claims.sessionId ?? null)) {
    return false;
  }
  if (claims.purpose === "cleanup") {
    return policy.state === "deleting";
  }
  return (
    policy.state === "active" &&
    policy.credentialExpiresAt.getTime() > Date.now() &&
    policy.expiresAt.getTime() > Date.now()
  );
};

/** Authenticate every guest command against both signed credentials and durable policy. */
export const authenticateDisposableGuest = async (
  request: ReadonlyNativeSurface<Request>
): Promise<{
  attributes: Record<string, string>;
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
  if (!claims || claims.modelId !== GUEST_POLICY.modelId) {
    return null;
  }
  const policy = await readGuestRuntimePolicy(claims.policyId, claims.ownerId);
  if (policy === null || !policyMatches(claims, policy)) {
    return null;
  }
  const operation = guestOperation(
    claims,
    new URL(request.url),
    request.method
  );
  if (operation === null) {
    return null;
  }
  const command = operation.body ? await readGuestBody(request) : undefined;
  if (operation.body && !operation.body.safeParse(command).success) {
    return null;
  }
  if (operation.send === true) {
    const admission = await reserveGuestRuntimeMessage({
      sessionId: claims.sessionId ?? "",
      ownerId: claims.ownerId,
      requestsPerMinute: GUEST_POLICY.requestsPerMinute,
      inputCharacters: message.parse(command).message.length,
      maxInputCharacters: GUEST_POLICY.maxInputCharacters,
    });
    if (admission !== "ready") {
      return null;
    }
  }
  return {
    attributes: {
      modelId: claims.modelId,
      chatjsSessionKind: "guest",
      chatjsPolicyVersion: GUEST_POLICY.version,
      chatjsPolicyId: policy.id,
    },
    authenticator: "chatjs-disposable-guest",
    issuer: "chatjs",
    principalId: claims.ownerId,
    principalType: "user",
    subject: claims.ownerId,
  };
};
