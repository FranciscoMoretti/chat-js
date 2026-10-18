import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { verifyLocalEveFamilyCoverage } from "./verify-local-coverage";

const mocks = vi.hoisted(() => ({
  end: vi.fn(),
  fetch: vi.fn<typeof fetch>(),
  verify: vi.fn(),
}));
vi.mock("postgres", () => ({ default: () => ({ end: mocks.end }) }));
vi.mock("node:fs/promises", () => ({
  realpath: async () => await Promise.resolve("/worker"),
}));
vi.mock("@/lib/eve/lifecycle/postgres/eve-sandbox-coverage-proof", () => ({
  verifyEveSandboxCoverage: mocks.verify,
}));
vi.mock("../env", () => ({
  env: {
    EVE_GATEWAY_SECRET: "fixture-secret",
    EVE_INTERNAL_ORIGIN: "http://worker.local",
    WORKFLOW_POSTGRES_URL: "postgresql://localhost",
  },
}));
vi.mock("./server", () => ({ assertEveConfigured: vi.fn() }));
const inventories = [{ sessionId: "root", runIds: ["root", "child"] }];
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", mocks.fetch);
  mocks.verify.mockResolvedValue(["root", "child"]);
  mocks.fetch.mockImplementation(
    async (url) =>
      await Promise.resolve(
        Response.json({
          appRoot: "/worker",
          sessionId: (url instanceof URL ? url.pathname : "").includes(
            "/child/"
          )
            ? "child"
            : "root",
          retired: true,
          remaining: 0,
        })
      )
  );
});
afterEach(() => vi.unstubAllGlobals());
it("rechecks worker authority for every session even when workflow coverage was retained", async () => {
  expect(
    await verifyLocalEveFamilyCoverage("owner", "/expected", inventories)
  ).toEqual({
    appRoot: "/worker",
    sessions: [
      { sessionId: "root", rootSessionId: "root" },
      { sessionId: "child", rootSessionId: "root" },
    ],
  });
  expect(mocks.fetch).toHaveBeenCalledTimes(2);
  const [url, init] = mocks.fetch.mock.calls.at(1) ?? [];
  expect(url).toEqual(
    new URL("http://worker.local/eve/chat/v1/session/child/local-resources")
  );
  expect(init?.method).toBe("POST");
  expect(init?.redirect).toBe("error");
  expect(init?.headers).toMatchObject({
    "x-chatjs-owner": "owner",
    "x-chatjs-deletion-root": "root",
  });
  expect(init?.body).toBe(
    JSON.stringify({
      expectedAppRoot: "/worker",
      action: "retire",
    })
  );
  expect(mocks.end).toHaveBeenCalledOnce();
});
it.each(["appRoot", "sessionId"])(
  "rejects a worker %s mismatch without accepting cleanup",
  async (field) => {
    mocks.fetch.mockImplementation(
      async () =>
        await Promise.resolve(
          Response.json({
            appRoot: "/worker",
            sessionId: "root",
            retired: true,
            remaining: 0,
            [field]: "different",
          })
        )
    );
    await expect(
      verifyLocalEveFamilyCoverage("owner", "/expected", inventories)
    ).rejects.toThrow("authority mismatch");
    expect(mocks.fetch).toHaveBeenCalledOnce();
    expect(mocks.end).toHaveBeenCalledOnce();
  }
);
it("does not treat failed worker retirement as absence", async () => {
  mocks.fetch.mockResolvedValue(new Response(null, { status: 503 }));
  await expect(
    verifyLocalEveFamilyCoverage("owner", "/expected", inventories)
  ).rejects.toThrow("unconfirmed");
});
