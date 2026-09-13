import { expect, test } from "vitest";

import {
  createEveGuestCredential,
  eveGuestIpHash,
  hashEveGuestToken,
} from "./guest-credential";

test("guest credentials are opaque, independently generated and reject legacy cookie identities", () => {
  const first = createEveGuestCredential();
  const second = createEveGuestCredential();
  expect(first.token).not.toBe(second.token);
  expect(first.tokenHash).not.toBe(first.token);
  expect(hashEveGuestToken(first.token)).toBe(first.tokenHash);
  expect(
    hashEveGuestToken(
      JSON.stringify({ id: crypto.randomUUID(), remainingCredits: 9999 })
    )
  ).toBeUndefined();
  expect(hashEveGuestToken(crypto.randomUUID())).toBeUndefined();
  expect(hashEveGuestToken("")).toBeUndefined();
});

test("IP quota keys are stable only within the server secret and contain no address", () => {
  const address = "192.0.2.1";
  const key = eveGuestIpHash(address, "test-secret");
  expect(key).toBe(eveGuestIpHash(address, "test-secret"));
  expect(key).not.toContain(address);
  expect(key).not.toBe(eveGuestIpHash(address, "other-secret"));
  expect(() => eveGuestIpHash(address, "")).toThrow();
});
