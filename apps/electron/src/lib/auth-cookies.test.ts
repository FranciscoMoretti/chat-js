import { describe, expect, test } from "bun:test";

import { hasSessionCookie, isBetterAuthCookieName } from "./auth-cookies";

describe("desktop session cookies", () => {
  test.each([
    "better-auth.session_token",
    "__Secure-better-auth.session_token",
    "chatjs-dev-0123456789abcdef.session_token",
    "__Secure-chatjs-dev-0123456789abcdef.session_token",
  ])("recognizes %s during sign-in and cookie sync", (name) => {
    expect(hasSessionCookie(`theme=dark; ${name}=signed=token; other=1`)).toBe(
      true
    );
    expect(isBetterAuthCookieName(name, "better-auth")).toBe(true);
  });

  test.each([
    "",
    "better-auth.session_token=",
    "better-auth.session_data=cached",
    "other=better-auth.session_token=value",
    "not_session_token=value",
    "chatjs-dev-123.session_token",
  ])("rejects a missing session token: %s", (header) => {
    expect(hasSessionCookie(header)).toBe(false);
  });
});

test("uses the configured prefix for non-session auth cookies", () => {
  expect(isBetterAuthCookieName("custom.state", "custom")).toBe(true);
  expect(isBetterAuthCookieName("__Secure-custom.state", "custom")).toBe(true);
  expect(isBetterAuthCookieName("unrelated.state", "custom")).toBe(false);
});
