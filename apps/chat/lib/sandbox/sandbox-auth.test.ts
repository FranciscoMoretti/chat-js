import { describe, expect, it, vi } from "vitest";
import { getVercelOidcTokenSync } from "@vercel/oidc";
import { setupSandboxTestEnvironment } from "./sandbox-test-environment";

const { configureSandboxCredentials } = setupSandboxTestEnvironment();
const jwt = (payload: unknown): string =>
  `header.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.signature`;

describe("resolveSandboxAuth", () => {
  it("resolves request-scoped OIDC credentials without an environment token", async () => {
    const token = jwt({ owner_id: "team", project_id: "project" });
    // oxlint-disable-next-line unicorn/no-useless-undefined -- Vitest requires an explicit undefined value to remove this environment variable.
    vi.stubEnv("VERCEL_OIDC_TOKEN", undefined);
    vi.stubGlobal(Symbol.for("@vercel/request-context"), {
      get: () => ({ headers: { "x-vercel-oidc-token": token } }),
    });
    expect(getVercelOidcTokenSync()).toBe(token);
    const { resolveSandboxAuth } =
      await import("@/chatjs/providers/sandbox/adapter");

    expect(resolveSandboxAuth()).toEqual({
      projectId: "project",
      teamId: "team",
      token,
    });
  });
  it("resolves the provider scope from an OIDC token", async () => {
    const token = jwt({ owner_id: "team", project_id: "project" });
    vi.stubEnv("VERCEL_OIDC_TOKEN", token);
    const { resolveSandboxAuth } =
      await import("@/chatjs/providers/sandbox/adapter");

    expect(resolveSandboxAuth()).toEqual({
      projectId: "project",
      teamId: "team",
      token,
    });
  });
  it("pins explicitly configured opaque credentials", async () => {
    configureSandboxCredentials();
    const { resolveSandboxAuth } =
      await import("@/chatjs/providers/sandbox/adapter");

    expect(resolveSandboxAuth()).toEqual({
      projectId: "project",
      teamId: "team",
      token: "opaque",
    });
  });
});

it.each([
  {
    configured: true,
    error: "scope do not match",
    name: "rejects a configured JWT whose scope disagrees with configuration",
    token: jwt({ owner_id: "other", project_id: "project" }),
  },
  {
    configured: true,
    error: "Sandbox provider identity is unavailable.",
    name: "rejects an incomplete JWT that could override configured scope",
    token: jwt({ owner_id: "other" }),
  },
  {
    configured: false,
    error: "Sandbox provider identity is unavailable.",
    name: "does not expose malformed token contents in errors",
    token: jwt({ private: "secret-payload" }),
  },
  {
    configured: false,
    error: "Sandbox provider identity is unavailable.",
    name: "rejects missing credentials without leaking provider errors",
  },
])(
  "resolveSandboxAuth $name",
  async ({
    configured,
    token,
    error,
  }: Readonly<{
    name: string;
    configured: boolean;
    token?: string;
    error: string;
  }>) => {
    if (configured) {
      configureSandboxCredentials(token);
    } else if (typeof token === "string") {
      vi.stubEnv("VERCEL_OIDC_TOKEN", token);
    }
    const { resolveSandboxAuth } =
      await import("@/chatjs/providers/sandbox/adapter");
    expect(() => resolveSandboxAuth()).toThrow(error);
  }
);

it("resolveSandboxAuth uses each request's token for execution and cleanup instead of a stale environment token", async () => {
  vi.stubEnv(
    "VERCEL_OIDC_TOKEN",
    jwt({ owner_id: "stale", project_id: "stale" })
  );
  let token = jwt({ owner_id: "team", project_id: "first" });
  vi.stubGlobal(Symbol.for("@vercel/request-context"), {
    get: () => ({ headers: { "x-vercel-oidc-token": token } }),
  });
  const { resolveSandboxAuth, createCleanupSession } =
    await import("@/chatjs/providers/sandbox/adapter");

  expect(resolveSandboxAuth()).toEqual({
    projectId: "first",
    teamId: "team",
    token,
  });
  token = jwt({ owner_id: "team", project_id: "second" });
  expect(createCleanupSession().provider).toEqual({
    projectId: "second",
    teamId: "team",
    token,
  });
});
