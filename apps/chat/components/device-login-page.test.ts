import { describe, expect, it } from "vitest";

import { getDeviceLoginDisplayState } from "./device-login-page";

describe("device login display state", () => {
  it("keeps retry progress visible on the waiting route", () => {
    expect(getDeviceLoginDisplayState("checking-session", true)).toBe(
      "waiting-for-app"
    );
    expect(getDeviceLoginDisplayState("transferring", true)).toBe(
      "transferring"
    );
    expect(getDeviceLoginDisplayState("waiting-for-app", true)).toBe(
      "waiting-for-app"
    );
  });

  it("preserves transfer and completion states for the electron route", () => {
    expect(getDeviceLoginDisplayState("checking-session", false)).toBe(
      "checking-session"
    );
    expect(getDeviceLoginDisplayState("transferring", false)).toBe(
      "transferring"
    );
    expect(getDeviceLoginDisplayState("waiting-for-app", false)).toBe(
      "waiting-for-app"
    );
  });
});
