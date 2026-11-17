import { expect, test, vi } from "vitest";
import { findSessionProfile } from "./session-profile";

const mocks = vi.hoisted(() => ({
  profiles: new Array<{ authenticator: string; instructions: string }>(),
}));
vi.mock("@/integrations/chat/session-profiles", () => ({
  sessionProfiles: mocks.profiles,
}));

test("removed application policies reject their persisted sessions without native fallback", () => {
  expect(() =>
    findSessionProfile({
      auth: { initiator: { authenticator: "chatjs-removed-plugin" } },
    })
  ).toThrow("not installed");
  expect(findSessionProfile({ auth: { initiator: null } })).toBeUndefined();
  expect(
    findSessionProfile({
      auth: { initiator: { authenticator: "slack-webhook" } },
    })
  ).toBeUndefined();
});
test("profile selection is pinned to the initiator, not reconnect authentication", () => {
  const profile = { authenticator: "test-profile", instructions: "restricted" };
  mocks.profiles.push(profile);
  try {
    const session = {
      auth: {
        initiator: { authenticator: "test-profile" },
        current: { authenticator: "chatjs-gateway" },
      },
    };
    expect(findSessionProfile(session)).toBe(profile);
  } finally {
    mocks.profiles.length = 0;
  }
});

test("ambiguous app-owned session profiles fail closed", () => {
  mocks.profiles.push(
    { authenticator: "same", instructions: "one" },
    { authenticator: "same", instructions: "two" }
  );
  try {
    expect(() =>
      findSessionProfile({ auth: { initiator: { authenticator: "same" } } })
    ).toThrow("Multiple session profiles");
  } finally {
    mocks.profiles.length = 0;
  }
});
