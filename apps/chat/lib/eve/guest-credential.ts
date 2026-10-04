/* oxlint-disable import/no-nodejs-modules --
 * import/no-nodejs-modules (#529): This server/tooling module requires import { createHash, createHmac, randomBytes } from "node:crypto";; its Node runtime boundary deliberately permits these built-ins.
 */
import { createHash, createHmac, randomBytes } from "node:crypto";

import { v5 as uuidv5 } from "uuid";
/* oxlint-enable import/no-nodejs-modules */

const CREDENTIAL_TOKEN_BYTES = 32;
const HASH = /^[0-9a-f]{64}$/u;

/**
 * Stable draft/ownership scope before admission, without exposing the credential hash.
 * @param tokenHash - Validated SHA-256 credential digest that identifies the guest.
 * @returns Deterministic UUID ownership scope for that credential digest.
 */
const eveGuestOwnerId = (tokenHash: string): string => {
  if (!HASH.test(tokenHash)) {
    throw new Error("Invalid guest credential hash.");
  }
  return uuidv5(`chatjs:eve:guest-owner:${tokenHash}`, uuidv5.URL);
};

const createEveGuestCredential = (): { token: string; tokenHash: string } => {
  const token = randomBytes(CREDENTIAL_TOKEN_BYTES).toString("base64url");
  return { token, tokenHash: createHash("sha256").update(token).digest("hex") };
};

/**
 * Hash a canonical, trusted client IP. The database never keeps the raw address.
 * @param address - Canonical IP obtained from the trusted forwarding policy.
 * @param secret - Server secret that isolates quota keys across installations.
 * @returns Stable quota key scoped to this server secret and client address.
 */
const eveGuestIpHash = (address: string, secret: string): string => {
  if (!(address && secret)) {
    throw new Error("A trusted client address and server secret are required.");
  }
  return createHmac("sha256", secret)
    .update(`eve-guest-ip:${address}`)
    .digest("hex");
};

export { eveGuestOwnerId, createEveGuestCredential, eveGuestIpHash };
