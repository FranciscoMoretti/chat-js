import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

import { z } from "zod";

import { env } from "../env";

export const GUEST_SESSION_DURATION_MS = 60 * 60 * 1000;

const claimsSchema = z
  .object({
    expiresAt: z.number().int().positive(),
    modelId: z.string().min(1),
    ownerId: z.uuid(),
    sessionId: z.string().min(1).optional(),
  })
  .strict();

const signature = (payload: string) =>
  createHmac("sha256", env.EVE_GATEWAY_SECRET)
    .update(`chatjs:disposable-guest:v1:${payload}`)
    .digest();

export const issueGuestCredential = (claims: z.infer<typeof claimsSchema>) => {
  const payload = Buffer.from(
    JSON.stringify(claimsSchema.parse(claims))
  ).toString("base64url");
  return `${payload}.${signature(payload).toString("base64url")}`;
};

export const newGuestClaims = (modelId: string) => ({
  expiresAt: Date.now() + GUEST_SESSION_DURATION_MS,
  modelId,
  ownerId: randomUUID(),
});

export const readGuestCredential = (token: string | null) => {
  if (!token || token.length > 2048) {
    return null;
  }
  const parts = token.split(".");
  if (parts.length !== 2) {
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
    return claims.expiresAt > Date.now() ? claims : null;
  } catch {
    return null;
  }
};
