import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { eveRequest } from "./server";

const mocks = vi.hoisted(() => ({
  env: {
    EVE_GATEWAY_SECRET: "eve-secret",
    EVE_INTERNAL_ORIGIN: "https://preview.example.com",
    VERCEL_AUTOMATION_BYPASS_SECRET: "deployment-secret",
    VERCEL_BRANCH_URL: "preview.example.com",
    VERCEL_URL: "deployment.example.com",
    WORKFLOW_POSTGRES_URL: "postgres://localhost/test",
  },
}));
vi.mock("@/lib/env", () => ({ env: mocks.env }));

beforeEach(() => {
  mocks.env.EVE_INTERNAL_ORIGIN = "https://preview.example.com";
});
afterEach(() => vi.unstubAllGlobals());

describe("EVE deployment authentication", () => {
  it("authenticates internal requests to this project's protected preview", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response());
    vi.stubGlobal("fetch", fetcher);
    await eveRequest("owner", "/eve/v1/operation/operation");
    const headers = new Headers(fetcher.mock.calls[0]?.[1]?.headers);
    expect(headers.get("x-vercel-protection-bypass")).toBe("deployment-secret");
    expect(headers.get("authorization")).toBe("Bearer eve-secret");
    expect(headers.get("x-chatjs-owner")).toBe("owner");
  });

  it("does not send the project deployment credential to a separate worker", async () => {
    mocks.env.EVE_INTERNAL_ORIGIN = "https://worker.example.com";
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response());
    vi.stubGlobal("fetch", fetcher);
    await eveRequest("owner", "/eve/v1/health");
    const headers = new Headers(fetcher.mock.calls[0]?.[1]?.headers);
    expect(headers.has("x-vercel-protection-bypass")).toBe(false);
  });
});
