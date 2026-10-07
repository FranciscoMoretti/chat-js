import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { describe, expect, it } from "vitest";
/* oxlint-enable sort-imports */

import { authSessionOptions } from "./auth-session-options";

const local = {
  baseUrl: "http://localhost:3000",
  databaseUrl: "postgres://dev:secret@localhost:5432/chat",
  development: true,
};

describe("development auth isolation", () => {
  it("isolates ports and databases while keeping restarts stable", () => {
    const first = authSessionOptions(local);
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the fresh shallow copy of local rather than sharing its source identity; pinned eslint/prefer-object-spread rejects Object.assign.
    expect(authSessionOptions({ ...local })).toEqual(first);
    for (const change of [
      { baseUrl: "http://localhost:3010" },
      { databaseUrl: "postgres://dev:secret@localhost:5432/other" },
    ]) {
      expect(
        // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing local own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement. Keep the existing change own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
        authSessionOptions({ ...local, ...change }).advanced.cookiePrefix
      ).not.toBe(first.advanced.cookiePrefix);
    }
    expect(first.session.cookieCache.enabled).toBe(false);
    expect(first.advanced.cookiePrefix).not.toContain("secret");
  });

  it("does not log out a worktree when only its database password rotates", () => {
    expect(
      authSessionOptions({
        // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing local own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
        ...local,
        databaseUrl: local.databaseUrl.replace("secret", "rotated"),
      })
    ).toEqual(authSessionOptions(local));
  });

  it("preserves production cookies and caching", () => {
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing local own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    expect(authSessionOptions({ ...local, development: false })).toEqual({
      advanced: { cookiePrefix: "better-auth" },
      session: { cookieCache: { enabled: true, maxAge: 300 } },
    });
  });
});

/* oxlint-disable typescript/explicit-function-return-type --
 * typescript/explicit-function-return-type (#560): Keep makeApp's return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 */
const makeApp = (baseUrl: string, databaseUrl: string) => {
  const data = { account: [], session: [], user: [], verification: [] };
  const auth = betterAuth({
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing authSessionOptions({ baseUrl, databaseUrl, development: true }) own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    ...authSessionOptions({ baseUrl, databaseUrl, development: true }),
    baseURL: baseUrl,
    database: memoryAdapter(data),
    emailAndPassword: { enabled: true },
    logger: { disabled: true },
    secret: "shared-development-secret-for-isolation-test",
  });
  return { auth, data };
};
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve signup's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable typescript/explicit-function-return-type */

/* oxlint-disable no-magic-numbers, typescript/prefer-readonly-parameter-types --
 * no-magic-numbers (#517): signup uses 200, 0 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * typescript/prefer-readonly-parameter-types (#565): signup accepts auth: ReturnType<typeof makeApp>["auth"]; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 */
const signup = async (
  auth: ReturnType<typeof makeApp>["auth"],
  origin: string,
  name: string
): Promise<string> => {
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-magic-numbers, typescript/prefer-readonly-parameter-types */

/* oxlint-disable max-statements --
 * max-statements (#512): it("two local apps sharing a browser cookie jar retain separate users") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 */
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable max-statements */
