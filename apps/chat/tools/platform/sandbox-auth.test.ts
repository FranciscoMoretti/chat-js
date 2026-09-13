import { beforeEach, expect, it, vi } from "vitest";

import { resolveSandboxAuth } from "./sandbox-auth";

const mocks = vi.hoisted(() => {
  const env: {
    VERCEL_TEAM_ID?: string;
    VERCEL_PROJECT_ID?: string;
    VERCEL_TOKEN?: string;
  } = {};
  return { token: vi.fn(), env };
});
vi.mock("@vercel/oidc", () => ({ getVercelOidcToken: mocks.token }));
vi.mock("@/lib/env", () => ({ env: mocks.env }));
const jwt = (payload: unknown) =>
  `header.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.signature`;
beforeEach(() => {
  vi.clearAllMocks();
  mocks.env.VERCEL_TEAM_ID = undefined;
  mocks.env.VERCEL_PROJECT_ID = undefined;
  mocks.env.VERCEL_TOKEN = undefined;
});
it("resolves a single OIDC token and its provider scope", async () => {
  const token = jwt({ owner_id: "team", project_id: "project" });
  mocks.token.mockResolvedValue(token);
  expect(await resolveSandboxAuth()).toEqual({
    teamId: "team",
    projectId: "project",
    token,
  });
});
it("pins explicitly configured opaque credentials without reading OIDC", async () => {
  Object.assign(mocks.env, {
    VERCEL_TEAM_ID: "team",
    VERCEL_PROJECT_ID: "project",
    VERCEL_TOKEN: "opaque",
  });
  expect(await resolveSandboxAuth()).toEqual({
    teamId: "team",
    projectId: "project",
    token: "opaque",
  });
  expect(mocks.token).not.toHaveBeenCalled();
});
it("rejects a JWT whose SDK scope would override configured credentials", async () => {
  Object.assign(mocks.env, {
    VERCEL_TEAM_ID: "team",
    VERCEL_PROJECT_ID: "project",
    VERCEL_TOKEN: jwt({ owner_id: "other", project_id: "project" }),
  });
  await expect(resolveSandboxAuth()).rejects.toThrow("scope do not match");
});
it("does not expose malformed token contents in errors", async () => {
  mocks.token.mockResolvedValue(jwt({ private: "secret-payload" }));
  await expect(resolveSandboxAuth()).rejects.toThrow(
    "Sandbox provider identity is unavailable."
  );
});

it("rejects incomplete JWT scope that the SDK would otherwise use to override the team", async () => {
  Object.assign(mocks.env, {
    VERCEL_TEAM_ID: "team",
    VERCEL_PROJECT_ID: "project",
    VERCEL_TOKEN: jwt({ owner_id: "other" }),
  });
  await expect(resolveSandboxAuth()).rejects.toThrow("identity is unavailable");
});
