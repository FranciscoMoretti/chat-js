import { createHash, createHmac, randomBytes } from "node:crypto";

import { v5 as uuidv5 } from "uuid";

const TOKEN = /^[A-Za-z0-9_-]{43}$/u;
const HASH = /^[0-9a-f]{64}$/u;

/** Stable draft/ownership scope before admission, without exposing the credential hash. */
export const eveGuestOwnerId = (tokenHash: string) => {
  if (!HASH.test(tokenHash)) {
    throw new Error("Invalid guest credential hash.");
  }
  return uuidv5(`chatjs:eve:guest-owner:${tokenHash}`, uuidv5.URL);
};

export const hashEveGuestToken = (token: string): string | undefined => {
  if (!TOKEN.test(token)) {
    return;
  }
  return createHash("sha256").update(token).digest("hex");
};

export const createEveGuestCredential = () => {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: createHash("sha256").update(token).digest("hex") };
};

/** Hash a canonical, trusted client IP. The database never keeps the raw address. */
export const eveGuestIpHash = (address: string, secret: string) => {
  if (!(address && secret)) {
    throw new Error("A trusted client address and server secret are required.");
  }
  return createHmac("sha256", secret)
    .update(`eve-guest-ip:${address}`)
    .digest("hex");
};
