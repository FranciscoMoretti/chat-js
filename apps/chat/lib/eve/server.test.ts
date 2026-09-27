import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { assertEveConfigured, eveRequest } from "./server";

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
  it("authenticates internal requests to this project's protected preview", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response());
    vi.stubGlobal("fetch", fetcher);
    await eveRequest("owner", "/eve/chat/v1/operation/operation");
    const headers = new Headers(fetcher.mock.calls[0]?.[1]?.headers);
    expect(headers.get("x-vercel-protection-bypass")).toBe("deployment-secret");
    expect(headers.get("authorization")).toBe("Bearer eve-secret");
    expect(headers.get("x-chatjs-owner")).toBe("owner");
  });

  it("does not send the project deployment credential to a separate worker", async () => {
    mocks.env.EVE_INTERNAL_ORIGIN = "https://worker.example.com";
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response());
    vi.stubGlobal("fetch", fetcher);
    await eveRequest("owner", "/eve/chat/v1/health");
    const headers = new Headers(fetcher.mock.calls[0]?.[1]?.headers);
    expect(headers.has("x-vercel-protection-bypass")).toBe(false);
  });
});

it("sends protocol requests directly to the named chat worker", async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response());
  vi.stubGlobal("fetch", fetcher);
  await eveRequest("owner", "/eve/chat/v1/operation/recovery?kind=seed");
  expect(String(fetcher.mock.calls[0]?.[0])).toBe(
    "https://preview.example.com/eve/chat/v1/operation/recovery?kind=seed"
  );
  expect(fetcher.mock.calls[0]?.[1]?.redirect).toBe("error");
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
  expect(String(fetcher.mock.calls[0]?.[0])).toBe(
    "https://preview.example.com/eve/chat/v1/health"
  );
  expect(fetcher.mock.calls[0]?.[1]?.redirect).toBe("error");
});

it("requires a workflow database locally but not on managed Vercel", () => {
  mocks.env.WORKFLOW_POSTGRES_URL = "";
  expect(assertEveConfigured).toThrow("local workflow database");
  mocks.env.VERCEL = "1";
  mocks.env.VERCEL_ENV = "preview";
  expect(assertEveConfigured).not.toThrow();
});
