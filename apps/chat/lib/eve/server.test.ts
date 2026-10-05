import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { assertEveConfigured, eveRequest } from "./server";

const FIRST_CALL = 0;
const URL_ARGUMENT = 0;
const INIT_ARGUMENT = 1;

const mocks = vi.hoisted(() => ({
  env: {
    EVE_GATEWAY_SECRET: "eve-secret",
    EVE_INTERNAL_ORIGIN: "https://preview.example.com",
    VERCEL: "",
    VERCEL_AUTOMATION_BYPASS_SECRET: "deployment-secret",
    VERCEL_BRANCH_URL: "preview.example.com",
    VERCEL_ENV: "",
    VERCEL_URL: "deployment.example.com",
    WORKFLOW_POSTGRES_URL: "postgres://localhost/test",
  },
}));
vi.mock("@/lib/env", () => ({ env: mocks.env }));

beforeEach(() => {
  mocks.env.VERCEL = "";
  mocks.env.VERCEL_ENV = "";
  mocks.env.WORKFLOW_POSTGRES_URL = "postgres://localhost/test";
  mocks.env.EVE_INTERNAL_ORIGIN = "https://preview.example.com";
});
afterEach(() => vi.unstubAllGlobals());

describe("EVE deployment authentication", () => {
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
  it("authenticates internal requests to this project's protected preview", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response());
    vi.stubGlobal("fetch", fetcher);
    await eveRequest("owner", "/eve/chat/v1/operation/operation");
    const headers = new Headers(
      // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading headers from fetcher.mock.calls[FIRST_CALL][INIT_ARGUMENT]; read INIT_ARGUMENT from fetcher.mock.calls[FIRST_CALL]; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
      fetcher.mock.calls[FIRST_CALL]?.[INIT_ARGUMENT]?.headers
    );
    expect(headers.get("x-vercel-protection-bypass")).toBe("deployment-secret");
    expect(headers.get("authorization")).toBe("Bearer eve-secret");
    expect(headers.get("x-chatjs-owner")).toBe("owner");
  });
  /* oxlint-enable oxc/no-async-await */
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
  it("does not send the project deployment credential to a separate worker", async () => {
    mocks.env.EVE_INTERNAL_ORIGIN = "https://worker.example.com";
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response());
    vi.stubGlobal("fetch", fetcher);
    await eveRequest("owner", "/eve/chat/v1/health");
    const headers = new Headers(
      // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading headers from fetcher.mock.calls[FIRST_CALL][INIT_ARGUMENT]; read INIT_ARGUMENT from fetcher.mock.calls[FIRST_CALL]; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
      fetcher.mock.calls[FIRST_CALL]?.[INIT_ARGUMENT]?.headers
    );
    expect(headers.has("x-vercel-protection-bypass")).toBe(false);
  });
  /* oxlint-enable oxc/no-async-await */
});

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
it("sends protocol requests directly to the named chat worker", async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response());
  vi.stubGlobal("fetch", fetcher);
  await eveRequest("owner", "/eve/chat/v1/operation/recovery?kind=seed");
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading URL_ARGUMENT from fetcher.mock.calls[FIRST_CALL]; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
  expect(fetcher.mock.calls[FIRST_CALL]?.[URL_ARGUMENT]).toEqual(
    new URL(
      "https://preview.example.com/eve/chat/v1/operation/recovery?kind=seed"
    )
  );
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading redirect from fetcher.mock.calls[FIRST_CALL][INIT_ARGUMENT]; read INIT_ARGUMENT from fetcher.mock.calls[FIRST_CALL]; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
  expect(fetcher.mock.calls[FIRST_CALL]?.[INIT_ARGUMENT]?.redirect).toBe(
    "error"
  );
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
it("routes the real SDK directly to the named chat worker", async () => {
  const { Client } = await import("eve/client");
  const { getEveConnectionOptions } = await import("./connection-options");
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValue(
      Response.json({ ok: true, status: "ready", workflowId: "workflow" })
    );
  vi.stubGlobal("fetch", fetcher);
  await new Client(getEveConnectionOptions("owner")).health();
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading URL_ARGUMENT from fetcher.mock.calls[FIRST_CALL]; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
  expect(fetcher.mock.calls[FIRST_CALL]?.[URL_ARGUMENT]).toBe(
    "https://preview.example.com/eve/chat/v1/health"
  );
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading redirect from fetcher.mock.calls[FIRST_CALL][INIT_ARGUMENT]; read INIT_ARGUMENT from fetcher.mock.calls[FIRST_CALL]; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
  expect(fetcher.mock.calls[FIRST_CALL]?.[INIT_ARGUMENT]?.redirect).toBe(
    "error"
  );
});
/* oxlint-enable oxc/no-async-await */
it("requires a workflow database locally but not on managed Vercel", () => {
  mocks.env.WORKFLOW_POSTGRES_URL = "";
  expect(assertEveConfigured).toThrow("local workflow database");
  mocks.env.VERCEL = "1";
  mocks.env.VERCEL_ENV = "preview";
  expect(assertEveConfigured).not.toThrow();
});
