/* oxlint-disable import/no-nodejs-modules, import/no-relative-parent-imports, sort-imports --
 * import/no-nodejs-modules (#529): This server/tooling module requires import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";; its Node runtime boundary deliberately permits these built-ins.
 * import/no-relative-parent-imports (#530): Keep the explicit "../env" dependency within this package instead of introducing an alias or barrel API.
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

import { z } from "zod";

import { env } from "../env";
/* oxlint-enable import/no-nodejs-modules, import/no-relative-parent-imports, sort-imports */

/* oxlint-disable import/exports-last, import/group-exports, import/no-named-export, no-magic-numbers --
 * import/exports-last (#522): GUEST_SESSION_DURATION_MS is directly exported at its declaration; moving it below executable initialization can obscure ordering and API ownership.
 * import/group-exports (#523): GUEST_SESSION_DURATION_MS stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named GUEST_SESSION_DURATION_MS API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * no-magic-numbers (#517): GUEST_SESSION_DURATION_MS uses 60, 1000 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 */
export const GUEST_SESSION_DURATION_MS = 60 * 60 * 1000;
/* oxlint-enable import/exports-last, import/group-exports, import/no-named-export, no-magic-numbers */

/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): claimsSchema uses 1 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 */
const claimsSchema = z
  .object({
    expiresAt: z.number().int().positive(),
    modelId: z.string().min(1),
    ownerId: z.uuid(),
    sessionId: z.string().min(1).optional(),
  })
  .strict();
/* oxlint-enable no-magic-numbers */

/* oxlint-disable typescript/explicit-function-return-type --
 * typescript/explicit-function-return-type (#560): Keep signature's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 */
const signature = (payload: string) =>
  createHmac("sha256", env.EVE_GATEWAY_SECRET)
    .update(`chatjs:disposable-guest:v1:${payload}`)
    .digest();
/* oxlint-enable typescript/explicit-function-return-type */

/* oxlint-disable import/group-exports, import/no-named-export --
 * import/group-exports (#523): issueGuestCredential stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named issueGuestCredential API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 */
export const issueGuestCredential = (
  claims: z.infer<typeof claimsSchema>
): string => {
  const payload = Buffer.from(
    JSON.stringify(claimsSchema.parse(claims))
  ).toString("base64url");
  return `${payload}.${signature(payload).toString("base64url")}`;
};
/* oxlint-enable import/group-exports, import/no-named-export */

/* oxlint-disable import/group-exports, import/no-named-export, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types --
 * import/group-exports (#523): newGuestClaims stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named newGuestClaims API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * typescript/explicit-function-return-type (#560): Keep newGuestClaims's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep newGuestClaims's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 */
export const newGuestClaims = (modelId: string) => ({
  expiresAt: Date.now() + GUEST_SESSION_DURATION_MS,
  modelId,
  ownerId: randomUUID(),
});
/* oxlint-enable import/group-exports, import/no-named-export, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types */

/* oxlint-disable import/group-exports, import/no-named-export, max-statements, no-magic-numbers, no-ternary, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/strict-boolean-expressions, unicorn/no-null --
 * import/group-exports (#523): readGuestCredential stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named readGuestCredential API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * max-statements (#512): readGuestCredential keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): readGuestCredential uses 2048, 2 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * no-ternary (#518): readGuestCredential derives branch values with conditional expressions; the enabled prefer-ternary rule also favors this form over assignment-only if statements.
 * typescript/explicit-function-return-type (#560): Keep readGuestCredential's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep readGuestCredential's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/strict-boolean-expressions (#610): readGuestCredential intentionally keeps the existing falsy-value behavior of token; distinguishing empty, zero, and absent states requires a domain behavior decision.
 * unicorn/no-null (#570): readGuestCredential preserves explicit null in its storage/API state; undefined has different serialization and presence semantics.
 */
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
/* oxlint-enable import/group-exports, import/no-named-export, max-statements, no-magic-numbers, no-ternary, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/strict-boolean-expressions, unicorn/no-null */
