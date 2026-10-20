import { expect, test } from "vitest";
import { isGuestSession, requireAccountSession } from "./session-policy";

test("session class is pinned to the verified initiator, not current caller attributes", () => {
  const guest = {
    auth: {
      initiator: { authenticator: "chatjs-disposable-guest", attributes: {} },
      current: {
        authenticator: "chatjs-gateway",
        attributes: { chatjsSessionKind: "account" },
      },
    },
  };
  expect(isGuestSession(guest)).toBe(true);
  expect(() => {
    requireAccountSession(guest);
  }).toThrow("account session");
  const account = {
    auth: {
      initiator: {
        authenticator: "chatjs-gateway",
        attributes: { chatjsSessionKind: "guest" },
      },
    },
  };
  expect(isGuestSession(account)).toBe(false);
  expect(() => {
    requireAccountSession(account);
  }).not.toThrow();
});
