import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { afterEach, expect, it, vi } from "vitest";

import { authSessionOptions } from "@/lib/auth-session-options";

import { GET } from "./route";

const HTTP_STATUS = {
  found: 302,
  notFound: 404,
};

const EXPECTED_DEVELOPMENT_USER_COUNT = 1;
const EXPECTED_DEVELOPMENT_SESSION_COUNT = 5;

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
vi.mock("@/lib/auth", () => ({
  get auth(): typeof state.auth {
    return state.auth;
  },
}));
vi.mock("@/lib/env", () => ({ env: { AUTH_SECRET: state.secret } }));
// Keep the route's database writes and Better Auth's reads in the same store.
type MockRows = Readonly<Record<string, unknown>>[];
interface MockReturning {
  returning: () => MockRows;
}
interface MockInsertResult extends MockReturning {
  onConflictDoNothing?: () => MockReturning;
}
interface MockDatabase {
  insert: (table: unknown) => {
    values: (row: Readonly<Record<string, unknown>>) => MockInsertResult;
  };
  select: () => { from: () => { where: () => MockRows } };
}
vi.mock("@/lib/db/client", async (): Promise<{ db: MockDatabase }> => {
  const { user } = await import("@/lib/db/schema");
  return {
    db: {
      insert: (table: unknown): ReturnType<MockDatabase["insert"]> => ({
        values: (row: Readonly<Record<string, unknown>>): MockInsertResult => {
          const target = table === user ? state.data.user : state.data.session;
          if (table !== user) {
            target.push(row);
            return { returning: () => [row] };
          }
          const insertUser = (ignoreConflict: boolean): MockRows => {
            if (
              target.some(
                (existing: Readonly<Record<string, unknown>>) =>
                  existing.email === row.email
              )
            ) {
              if (ignoreConflict) {
                return [];
              }
              throw new Error("duplicate key violates user_email_unique");
            }
            target.push(row);
            return [row];
          };
          return {
            onConflictDoNothing: (): MockReturning => ({
              returning: (): MockRows => insertUser(true),
            }),
            returning: (): MockRows => insertUser(false),
          };
        },
      }),
      select: (): ReturnType<MockDatabase["select"]> => ({
        from: (): ReturnType<ReturnType<MockDatabase["select"]>["from"]> => ({
          where: (): MockRows => [...state.data.user],
        }),
      }),
    },
  };
});

afterEach(() => {
  vi.unstubAllEnvs();
  state.data.user.length = 0;
  state.data.session.length = 0;
});

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
    const responses = await Promise.all(
      Array.from({ length: 4 }, async () => await GET())
    );
    expect(
      responses.map((result: { readonly status: number }) => result.status)
    ).toEqual([
      HTTP_STATUS.found,
      HTTP_STATUS.found,
      HTTP_STATUS.found,
      HTTP_STATUS.found,
    ]);
    const [response] = responses;
    expect(response.status).toBe(HTTP_STATUS.found);
    expect(response.headers.get("location")).toBe("/");
    const [cookie] = response.headers.getSetCookie();
    const { authCookies } = await auth.$context;
    expect(cookie.startsWith(`${authCookies.sessionToken.name}=`)).toBe(true);
    expect(cookie.includes("; Secure")).toBe(baseUrl.startsWith("https:"));
    expect(cookie).toContain("; HttpOnly");
    const [sessionCookie] = cookie.split(";");
    const headers = new Headers({ cookie: sessionCookie });
    expect(await auth.api.getSession({ headers })).toMatchObject({
      user: { email: "dev@localhost", name: "Dev User" },
    });
    await GET();
    expect(state.data.user).toHaveLength(EXPECTED_DEVELOPMENT_USER_COUNT);
    expect(state.data.session).toHaveLength(EXPECTED_DEVELOPMENT_SESSION_COUNT);
  }
);

it("does not create a session outside development", async () => {
  vi.stubEnv("NODE_ENV", "production");
  const response = await GET();
  expect(response.status).toBe(HTTP_STATUS.notFound);
  expect(response.headers.getSetCookie()).toEqual([]);
  expect(state.data.session).toEqual([]);
});
