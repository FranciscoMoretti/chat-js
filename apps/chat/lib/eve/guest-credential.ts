import { createHash, createHmac, randomBytes } from "node:crypto";

const TOKEN = /^[A-Za-z0-9_-]{43}$/;

export function hashEveGuestToken(token: string): string | undefined {
  if (!TOKEN.test(token)) {
    return;
  }
  return createHash("sha256").update(token).digest("hex");
}

export function createEveGuestCredential() {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: createHash("sha256").update(token).digest("hex") };
}

/** Hash a canonical, trusted client IP. The database never keeps the raw address. */
export function eveGuestIpHash(address: string, secret: string) {
  if (!(address && secret)) {
    throw new Error("A trusted client address and server secret are required.");
  }
  return createHmac("sha256", secret)
    .update(`eve-guest-ip:${address}`)
    .digest("hex");
}
