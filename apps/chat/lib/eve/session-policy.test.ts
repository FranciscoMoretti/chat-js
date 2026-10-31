import { expect, test } from "vitest";
import { guestModelIdForGateway } from "@/plugins/guest-chat/guest-policy";
import { isAccountSession, requireAccountSession } from "./session-identity";

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
  expect(isAccountSession(guest)).toBe(false);
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
  expect(isAccountSession(account)).toBe(true);
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

test("account capabilities reject unknown authenticators", () => {
  expect(() => {
    requireAccountSession({
      auth: { initiator: { authenticator: "uninstalled-profile" } },
    });
  }).toThrow("account session");
});
