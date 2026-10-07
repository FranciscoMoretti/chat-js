import { expect, test } from "vitest";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { createEveGuestCredential, eveGuestIpHash } from "./guest-credential";
/* oxlint-enable sort-imports */

test("legacy cleanup fixture credentials are independently generated", () => {
  const first = createEveGuestCredential();
  const second = createEveGuestCredential();
  expect(first.token).not.toBe(second.token);
  expect(first.tokenHash).not.toBe(first.token);
});

test("IP quota keys are stable only within the server secret and contain no address", () => {
  const address = "192.0.2.1";
  const key = eveGuestIpHash(address, "test-secret");
  expect(key).toBe(eveGuestIpHash(address, "test-secret"));
  expect(key).not.toContain(address);
  expect(key).not.toBe(eveGuestIpHash(address, "other-secret"));
  expect(() => eveGuestIpHash(address, "")).toThrow();
});
