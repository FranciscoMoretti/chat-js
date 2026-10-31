import { expect, test, vi } from "vitest";
import { requireSessionProfile } from "./session-profile";

const mocks = vi.hoisted(() => ({
  profiles: new Array<{ authenticator: string; instructions: string }>(),
}));
vi.mock("@/integrations/chat/session-profiles", () => ({
  sessionProfiles: mocks.profiles,
}));

test("missing plugins reject persisted non-account sessions without account fallback", () => {
  expect(() =>
    requireSessionProfile({
      auth: { initiator: { authenticator: "removed-plugin" } },
    })
  ).toThrow("not installed");
  expect(() => requireSessionProfile({ auth: { initiator: null } })).toThrow(
    "not installed"
  );
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
    expect(requireSessionProfile(session)).toBe(profile);
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
      requireSessionProfile({ auth: { initiator: { authenticator: "same" } } })
    ).toThrow("Multiple session profiles");
  } finally {
    mocks.profiles.length = 0;
  }
});
