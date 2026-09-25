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
vi.mock("@/lib/auth", () => ({
  get auth() {
    return state.auth;
  },
}));
vi.mock("@/lib/env", () => ({ env: { AUTH_SECRET: state.secret } }));
// Keep the route's database writes and Better Auth's reads in the same store.
vi.mock("@/lib/db/client", async () => {
  const { user } = await import("@/lib/db/schema");
  return {
    db: {
      insert: (table: unknown) => ({
        values: (row: Record<string, unknown>) => {
          const target = table === user ? state.data.user : state.data.session;
          target.push(row);
          return { returning: () => [row] };
        },
      }),
      select: () => ({ from: () => ({ where: () => state.data.user }) }),
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
    const response = await GET();
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
    expect(state.data.session).toHaveLength(2);
  }
);

it("does not create a session outside development", async () => {
  vi.stubEnv("NODE_ENV", "production");
  const response = await GET();
  expect(response.status).toBe(404);
  expect(response.headers.getSetCookie()).toEqual([]);
  expect(state.data.session).toHaveLength(0);
});
