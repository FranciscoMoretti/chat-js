import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { afterEach, expect, it, vi } from "vitest";

import { authSessionOptions } from "@/lib/auth-session-options";

import { GET } from "./route";

const state = vi.hoisted(() => {
  const data: Record<"user" | "session", Record<string, unknown>[]> = {
    session: [],
    user: [],
  };
  const initial: {
    auth?: {
      $context: Promise<{
        authCookies: {
          sessionToken: { name: string; attributes: { secure?: boolean } };
        };
      }>;
    };
    data: typeof data;
    secret: string;
  } = {
    data,
    secret: "development-route-roundtrip-secret-12345",
  };
  return initial;
});
/* oxlint-disable typescript/explicit-function-return-type --
 * typescript/explicit-function-return-type (#560): Keep vi.mock("@/lib/auth")'s return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 */
vi.mock("@/lib/auth", () => ({
  get auth() {
    return state.auth;
  },
}));
/* oxlint-enable typescript/explicit-function-return-type */
vi.mock("@/lib/env", () => ({ env: { AUTH_SECRET: state.secret } }));
/* oxlint-disable typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types  --
 * no-ternary (#518): vi.mock("@/lib/db/client") derives branch values with conditional expressions; the enabled prefer-ternary rule also favors this form over assignment-only if statements.
 * oxc/no-async-await (#540): vi.mock("@/lib/db/client") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * typescript/explicit-function-return-type (#560): Keep vi.mock("@/lib/db/client")'s return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): vi.mock("@/lib/db/client") accepts row: Record<string, unknown>; existing; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 */
// Keep the route's database writes and Better Auth's reads in the same store.
vi.mock("@/lib/db/client", async () => {
  const { user } = await import("@/lib/db/schema");
  return {
    db: {
      insert: (table: unknown) => ({
        values: (row: Record<string, unknown>) => {
          const target = table === user ? state.data.user : state.data.session;
          if (table !== user) {
            target.push(row);
            return { returning: () => [row] };
          }
          const insertUser = (ignoreConflict: boolean) => {
            if (target.some((existing) => existing.email === row.email)) {
              if (ignoreConflict) {
                return [];
              }
              throw new Error("duplicate key violates user_email_unique");
            }
            target.push(row);
            return [row];
          };
          return {
            onConflictDoNothing: () => ({ returning: () => insertUser(true) }),
            returning: () => insertUser(false),
          };
        },
      }),
      select: () => ({ from: () => ({ where: () => [...state.data.user] }) }),
    },
  };
});
/* oxlint-enable typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types */

afterEach(() => {
  vi.unstubAllEnvs();
  state.data.user.length = 0;
  state.data.session.length = 0;
});

/* oxlint-disable max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/promise-function-async  --
 * max-statements (#512): it.each(["http://localhost:3100", "https://localhost:3100"])("dev-login issues a vali keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): it.each(["http://localhost:3100", "https://localhost:3100"])("dev-login issues a vali uses 302, 0, 1, 5 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * oxc/no-async-await (#540): it.each(["http://localhost:3100", "https://localhost:3100"])("dev-login issues a vali sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * oxc/no-rest-spread-properties (#543): it.each(["http://localhost:3100", "https://localhost:3100"])("dev-login issues a vali copies or separates ...authSessionOptions({ baseUrl, databaseUrl: "postgres://dev:secret@localhost:5432/ while preserving existing object ownership; mutating source objects is not equivalent.
 * typescript/prefer-readonly-parameter-types (#565): it.each(["http://localhost:3100", "https://localhost:3100"])("dev-login issues a vali accepts result; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): it.each(["http://localhost:3100", "https://localhost:3100"])("dev-login issues a vali preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
it.each(["http://localhost:3100", "https://localhost:3100"])(
  "dev-login issues a valid configured cookie on %s",
  async (baseUrl) => {
    vi.stubEnv("NODE_ENV", "development");
    const auth = betterAuth({
      ...authSessionOptions({
        baseUrl,
        databaseUrl: "postgres://dev:secret@localhost:5432/chat",
        development: true,
      }),
      baseURL: baseUrl,
      database: memoryAdapter(state.data),
      logger: { disabled: true },
      secret: state.secret,
    });
    state.auth = auth;
    const responses = await Promise.all(Array.from({ length: 4 }, () => GET()));
    expect(responses.map((result) => result.status)).toEqual([
      302, 302, 302, 302,
    ]);
    const [response] = responses;
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/");
    const [cookie] = response.headers.getSetCookie();
    const { authCookies } = await auth.$context;
    expect(cookie.startsWith(`${authCookies.sessionToken.name}=`)).toBe(true);
    expect(cookie.includes("; Secure")).toBe(baseUrl.startsWith("https:"));
    expect(cookie).toContain("; HttpOnly");
    const headers = new Headers({ cookie: cookie.split(";")[0] });
    expect(await auth.api.getSession({ headers })).toMatchObject({
      user: { email: "dev@localhost", name: "Dev User" },
    });
    await GET();
    expect(state.data.user).toHaveLength(1);
    expect(state.data.session).toHaveLength(5);
  }
);
/* oxlint-enable max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/promise-function-async */

/* oxlint-disable no-magic-numbers  --
 * no-magic-numbers (#517): it("does not create a session outside development") uses 404, 0 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * oxc/no-async-await (#540): it("does not create a session outside development") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 */
it("does not create a session outside development", async () => {
  vi.stubEnv("NODE_ENV", "production");
  const response = await GET();
  expect(response.status).toBe(404);
  expect(response.headers.getSetCookie()).toEqual([]);
  expect(state.data.session).toHaveLength(0);
});
/* oxlint-enable no-magic-numbers */
