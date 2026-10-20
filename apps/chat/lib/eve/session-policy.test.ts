import { expect, test } from "vitest";
import { guestModelIdForGateway } from "./session-policy";
import { isGuestSession, requireAccountSession } from "./session-identity";

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

test("account capabilities reject missing persisted authentication", () => {
  expect(() => {
    requireAccountSession({ auth: { initiator: null } });
  }).toThrow("account session");
});
test("guest model stays GPT-5 nano across gateway naming conventions", () => {
  expect(guestModelIdForGateway("openai")).toBe("gpt-5-nano");
  expect(guestModelIdForGateway("vercel")).toBe("openai/gpt-5-nano");
  expect(guestModelIdForGateway("openrouter")).toBe("openai/gpt-5-nano");
});
