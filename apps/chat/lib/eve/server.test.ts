import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { assertEveConfigured, eveRequest } from "./server";

const FIRST_CALL = 0;
const URL_ARGUMENT = 0;
const INIT_ARGUMENT = 1;

const mocks = vi.hoisted(() => ({
  oidc: vi.fn(() => "invocation-token"),
  env: {
    EVE_GATEWAY_SECRET: "eve-secret",
    EVE_INTERNAL_ORIGIN: "https://preview.example.com",
    VERCEL: "",
    VERCEL_BRANCH_URL: "preview.example.com",
    VERCEL_ENV: "",
    VERCEL_URL: "deployment.example.com",
    WORKFLOW_POSTGRES_URL: "postgres://localhost/test",
  },
}));
vi.mock("@/lib/env", () => ({ env: mocks.env }));
vi.mock("@vercel/oidc", () => ({ getVercelOidcTokenSync: mocks.oidc }));

beforeEach(() => {
  mocks.oidc.mockReset().mockReturnValue("invocation-token");
  mocks.env.VERCEL = "";
  mocks.env.VERCEL_ENV = "";
  mocks.env.WORKFLOW_POSTGRES_URL = "postgres://localhost/test";
  mocks.env.EVE_INTERNAL_ORIGIN = "https://preview.example.com";
});
afterEach(() => vi.unstubAllGlobals());

describe("EVE deployment authentication", () => {
  it("authenticates internal requests to this project's protected preview", async () => {
    mocks.env.VERCEL = "1";
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response());
    vi.stubGlobal("fetch", fetcher);
    await eveRequest("owner", "/eve/chat/v1/operation/operation");
    const headers = new Headers(
      (fetcher.mock.calls[FIRST_CALL][INIT_ARGUMENT] ?? {}).headers
    );
    expect(headers.get("x-vercel-trusted-oidc-idp-token")).toBe(
      "invocation-token"
    );
    expect(headers.get("authorization")).toBe("Bearer eve-secret");
    expect(headers.get("x-chatjs-owner")).toBe("owner");
  });
  it("does not send the project deployment credential to a separate worker", async () => {
    mocks.env.VERCEL = "1";
    mocks.env.EVE_INTERNAL_ORIGIN = "https://worker.example.com";
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response());
    vi.stubGlobal("fetch", fetcher);
    await eveRequest("owner", "/eve/chat/v1/health");
    const headers = new Headers(
      (fetcher.mock.calls[FIRST_CALL][INIT_ARGUMENT] ?? {}).headers
    );
    expect(headers.has("x-vercel-trusted-oidc-idp-token")).toBe(false);
    expect(mocks.oidc).not.toHaveBeenCalled();
  });
  it("reads a fresh invocation identity on each request", async () => {
    mocks.env.VERCEL = "1";
    mocks.oidc.mockReturnValueOnce("first").mockReturnValueOnce("second");
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response());
    vi.stubGlobal("fetch", fetcher);
    await eveRequest("owner", "/eve/chat/v1/health");
    await eveRequest("owner", "/eve/chat/v1/health");
    expect(
      fetcher.mock.calls.map(([, init]) =>
        new Headers(init?.headers).get("x-vercel-trusted-oidc-idp-token")
      )
    ).toEqual(["first", "second"]);
  });
  it("keeps local requests independent of Vercel identity", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response());
    vi.stubGlobal("fetch", fetcher);
    await eveRequest("owner", "/eve/chat/v1/health");
    expect(mocks.oidc).not.toHaveBeenCalled();
  });
});

it("sends protocol requests directly to the named chat worker", async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response());
  vi.stubGlobal("fetch", fetcher);
  await eveRequest("owner", "/eve/chat/v1/operation/recovery?kind=seed");
  expect(fetcher.mock.calls[FIRST_CALL][URL_ARGUMENT]).toEqual(
    new URL(
      "https://preview.example.com/eve/chat/v1/operation/recovery?kind=seed"
    )
  );
  expect((fetcher.mock.calls[FIRST_CALL][INIT_ARGUMENT] ?? {}).redirect).toBe(
    "error"
  );
});
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
  expect(fetcher.mock.calls[FIRST_CALL][URL_ARGUMENT]).toBe(
    "https://preview.example.com/eve/chat/v1/health"
  );
  expect((fetcher.mock.calls[FIRST_CALL][INIT_ARGUMENT] ?? {}).redirect).toBe(
    "error"
  );
});
it("requires a workflow database locally but not on managed Vercel", () => {
  mocks.env.WORKFLOW_POSTGRES_URL = "";
  expect(assertEveConfigured).toThrow("local workflow database");
  mocks.env.VERCEL = "1";
  mocks.env.VERCEL_ENV = "preview";
  expect(assertEveConfigured).not.toThrow();
});
