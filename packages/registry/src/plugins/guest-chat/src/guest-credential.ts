import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
import { z } from "zod";

import { GUEST_POLICY } from "@/plugins/guest-chat/guest-policy";

const MINIMUM_IDENTIFIER_LENGTH = 1;
const MAXIMUM_CREDENTIAL_CHARACTERS = 2048;
const SIGNED_CREDENTIAL_PART_COUNT = 2;
const GUEST_SESSION_DURATION_MS = GUEST_POLICY.credentialDurationMs;

const claimsSchema = z
  .object({
    expiresAt: z.number().int().positive(),
    policyId: z.uuid(),
    purpose: z.enum(["chat", "cleanup"]).default("chat"),
    modelId: z.string().min(MINIMUM_IDENTIFIER_LENGTH),
    ownerId: z.uuid(),
    sessionId: z.string().min(MINIMUM_IDENTIFIER_LENGTH).optional(),
  })
  .strict();

const signature = (payload: string): Buffer =>
  createHmac("sha256", env.EVE_GATEWAY_SECRET)
    .update(`chatjs:disposable-guest:v2:${payload}`)
    .digest();

const issueGuestCredential = (claims: z.infer<typeof claimsSchema>): string => {
  const payload = Buffer.from(
    JSON.stringify(claimsSchema.parse(claims))
  ).toString("base64url");
  return `${payload}.${signature(payload).toString("base64url")}`;
};

const newGuestClaims = (
  modelId: string
): {
  expiresAt: number;
  policyId: string;
  purpose: "chat";
  modelId: string;
  ownerId: ReturnType<typeof randomUUID>;
} => ({
  expiresAt: Date.now() + GUEST_SESSION_DURATION_MS,
  policyId: randomUUID(),
  purpose: "chat",
  modelId,
  ownerId: randomUUID(),
});

const readGuestCredential = (
  token: string | null
): z.infer<typeof claimsSchema> | null => {
  if (
    token === null ||
    token === "" ||
    token.length > MAXIMUM_CREDENTIAL_CHARACTERS
  ) {
    return null;
  }
  const parts = token.split(".");
  if (parts.length !== SIGNED_CREDENTIAL_PART_COUNT) {
    return null;
  }
  const [payload, supplied] = parts;
  const actual = Buffer.from(supplied, "base64url");
  const expected = signature(payload);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return null;
  }
  try {
    const claims = claimsSchema.parse(
      JSON.parse(Buffer.from(payload, "base64url").toString())
    );

    if (claims.expiresAt > Date.now()) {
      return claims;
    }
    return null;
  } catch {
    return null;
  }
};
export {
  GUEST_SESSION_DURATION_MS,
  issueGuestCredential,
  newGuestClaims,
  readGuestCredential,
};
