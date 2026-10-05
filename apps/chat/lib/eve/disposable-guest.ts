/* oxlint-disable import/no-nodejs-modules --
 * import/no-nodejs-modules (#529): This server/tooling module requires import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";; its Node runtime boundary deliberately permits these built-ins.
 */
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

import { z } from "zod";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { env } from "@/lib/env";
/* oxlint-enable sort-imports */
/* oxlint-enable import/no-nodejs-modules */

const MINUTES_PER_HOUR = 60;
const SECONDS_PER_MINUTE = 60;
const MILLISECONDS_PER_SECOND = 1000;
const MINIMUM_IDENTIFIER_LENGTH = 1;
const MAXIMUM_CREDENTIAL_CHARACTERS = 2048;
const SIGNED_CREDENTIAL_PART_COUNT = 2;
const GUEST_SESSION_DURATION_MS =
  MINUTES_PER_HOUR * SECONDS_PER_MINUTE * MILLISECONDS_PER_SECOND;

const claimsSchema = z
  .object({
    expiresAt: z.number().int().positive(),
    modelId: z.string().min(MINIMUM_IDENTIFIER_LENGTH),
    ownerId: z.uuid(),
    sessionId: z.string().min(MINIMUM_IDENTIFIER_LENGTH).optional(),
  })
  .strict();

const signature = (payload: string): Buffer =>
  createHmac("sha256", env.EVE_GATEWAY_SECRET)
    .update(`chatjs:disposable-guest:v1:${payload}`)
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
  modelId: string;
  ownerId: ReturnType<typeof randomUUID>;
} => ({
  expiresAt: Date.now() + GUEST_SESSION_DURATION_MS,
  modelId,
  ownerId: randomUUID(),
});

// Preserve the empty/absent-token gate while making its string narrowing explicit.
const hasCredentialText = (value: string | null): value is string =>
  Boolean(value);

/* oxlint-disable max-statements, unicorn/no-null -- max-statements (#512): readGuestCredential keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
unicorn/no-null (#570): readGuestCredential preserves explicit null in its storage/API state; undefined has different serialization and presence semantics. */
const readGuestCredential = (
  token: string | null
): z.infer<typeof claimsSchema> | null => {
  if (
    !hasCredentialText(token) ||
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
    return claims.expiresAt > Date.now() ? claims : null;
  } catch {
    return null;
  }
};
/* oxlint-enable max-statements, unicorn/no-null */
export {
  GUEST_SESSION_DURATION_MS,
  issueGuestCredential,
  newGuestClaims,
  readGuestCredential,
};
