import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { describe, expect, it } from "vitest";

import { authSessionOptions } from "./auth-session-options";

const local = {
  baseUrl: "http://localhost:3000",
  databaseUrl: "postgres://dev:secret@localhost:5432/chat",
  development: true,
};

describe("development auth isolation", () => {
  it("isolates ports and databases while keeping restarts stable", () => {
    const first = authSessionOptions(local);
    expect(authSessionOptions({ ...local })).toEqual(first);
    for (const change of [
      { baseUrl: "http://localhost:3010" },
      { databaseUrl: "postgres://dev:secret@localhost:5432/other" },
    ]) {
      expect(
        authSessionOptions({ ...local, ...change }).advanced.cookiePrefix
      ).not.toBe(first.advanced.cookiePrefix);
    }
    expect(first.session.cookieCache.enabled).toBe(false);
    expect(first.advanced.cookiePrefix).not.toContain("secret");
  });

  it("does not log out a worktree when only its database password rotates", () => {
    expect(
      authSessionOptions({
        ...local,
        databaseUrl: local.databaseUrl.replace("secret", "rotated"),
      })
    ).toEqual(authSessionOptions(local));
  });

  it("preserves production cookies and caching", () => {
    expect(authSessionOptions({ ...local, development: false })).toEqual({
      advanced: { cookiePrefix: "better-auth" },
      session: { cookieCache: { enabled: true, maxAge: 300 } },
    });
  });
});

const makeApp = (baseUrl: string, databaseUrl: string) => {
  const data = { account: [], session: [], user: [], verification: [] };
  const auth = betterAuth({
    ...authSessionOptions({ baseUrl, databaseUrl, development: true }),
    baseURL: baseUrl,
    database: memoryAdapter(data),
    emailAndPassword: { enabled: true },
    logger: { disabled: true },
    secret: "shared-development-secret-for-isolation-test",
  });
  return { auth, data };
};

const signup = async (
  auth: ReturnType<typeof makeApp>["auth"],
  origin: string,
  name: string
) => {
  const response = await auth.handler(
    new Request(`${origin}/api/auth/sign-up/email`, {
      body: JSON.stringify({
        email: `${name}@example.com`,
        name,
        password: "test-password-12345",
      }),
      headers: { "content-type": "application/json", origin },
      method: "POST",
    })
  );
  expect(response.status).toBe(200);
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .join("; ");
};

it("two local apps sharing a browser cookie jar retain separate users", async () => {
  const first = makeApp(local.baseUrl, local.databaseUrl);
  const secondUrl = "http://localhost:3010";
  const second = makeApp(secondUrl, local.databaseUrl);
  const firstCookies = await signup(first.auth, local.baseUrl, "first");
  const secondCookies = await signup(second.auth, secondUrl, "second");
  const cookie = `${firstCookies}; ${secondCookies}`;
  const headers = new Headers({ cookie });
  expect(await first.auth.api.getSession({ headers })).toMatchObject({
    user: { name: "first" },
  });
  expect(await second.auth.api.getSession({ headers })).toMatchObject({
    user: { name: "second" },
  });
  const switchedDatabase = makeApp(
    local.baseUrl,
    "postgres://dev:secret@localhost:5432/new-branch"
  );
  expect(await switchedDatabase.auth.api.getSession({ headers })).toBeNull();
  first.data.user.length = 0;
  first.data.session.length = 0;
  expect(await first.auth.api.getSession({ headers })).toBeNull();
  expect(await second.auth.api.getSession({ headers })).toMatchObject({
    user: { name: "second" },
  });
});
