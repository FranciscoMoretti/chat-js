/* oxlint-disable import/no-nodejs-modules --
 * import/no-nodejs-modules (#529): This server/tooling module requires import { createHash, createHmac, randomBytes } from "node:crypto";; its Node runtime boundary deliberately permits these built-ins.
 */
import { createHash, createHmac, randomBytes } from "node:crypto";

import { v5 as uuidv5 } from "uuid";
/* oxlint-enable import/no-nodejs-modules */

const HASH = /^[0-9a-f]{64}$/u;

/* oxlint-disable import/group-exports, jsdoc/require-param, jsdoc/require-returns  --
 * import/group-exports (#523): eveGuestOwnerId stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named eveGuestOwnerId API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * jsdoc/require-param (#534): eveGuestOwnerId's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): eveGuestOwnerId's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 */
/** Stable draft/ownership scope before admission, without exposing the credential hash. */
export const eveGuestOwnerId = (tokenHash: string): string => {
  if (!HASH.test(tokenHash)) {
    throw new Error("Invalid guest credential hash.");
  }
  return uuidv5(`chatjs:eve:guest-owner:${tokenHash}`, uuidv5.URL);
};
/* oxlint-enable import/group-exports, jsdoc/require-param, jsdoc/require-returns */

/* oxlint-disable import/group-exports, no-magic-numbers, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types  --
 * import/group-exports (#523): createEveGuestCredential stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named createEveGuestCredential API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * no-magic-numbers (#517): createEveGuestCredential uses 32 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * typescript/explicit-function-return-type (#560): Keep createEveGuestCredential's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep createEveGuestCredential's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 */
export const createEveGuestCredential = () => {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: createHash("sha256").update(token).digest("hex") };
};
/* oxlint-enable import/group-exports, no-magic-numbers, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types */

/* oxlint-disable import/group-exports, jsdoc/require-param, jsdoc/require-returns  --
 * import/group-exports (#523): eveGuestIpHash stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named eveGuestIpHash API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * jsdoc/require-param (#534): eveGuestIpHash's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): eveGuestIpHash's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 */
/** Hash a canonical, trusted client IP. The database never keeps the raw address. */
export const eveGuestIpHash = (address: string, secret: string): string => {
  if (!(address && secret)) {
    throw new Error("A trusted client address and server secret are required.");
  }
  return createHmac("sha256", secret)
    .update(`eve-guest-ip:${address}`)
    .digest("hex");
};
/* oxlint-enable import/group-exports, jsdoc/require-param, jsdoc/require-returns */
