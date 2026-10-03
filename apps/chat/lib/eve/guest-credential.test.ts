/* oxlint-disable sort-imports --
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
import { expect, test } from "vitest";

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
