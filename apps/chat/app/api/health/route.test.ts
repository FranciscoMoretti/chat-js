import * as timers from "node:timers/promises";

import { afterEach, expect, test, vi } from "vitest";

import { GET } from "./route";

const HTTP_STATUS = {
  ok: 200,
  serviceUnavailable: 503,
};

const database = vi.hoisted(() => vi.fn<() => Promise<void>>());
vi.mock("node:timers/promises", { spy: true });
vi.mock("@/lib/db/health", () => ({ checkDatabase: database }));
vi.mock("@/lib/env", () => ({
  env: {
    EVE_INTERNAL_ORIGIN: "http://localhost:3790",
    NODE_ENV: "production",
  },
}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.resetAllMocks();
  vi.restoreAllMocks();
});

test("requires a genuine Eve health response, not a login page", async () => {
  database.mockResolvedValue();
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response("<html>login</html>"))
  );
  const resolvedResult1 = await GET();
  expect(resolvedResult1.status).toBe(HTTP_STATUS.serviceUnavailable);
});

test("reports ready only with database and Eve available", async () => {
  const timeout = vi.mocked(timers.setTimeout);
  database.mockResolvedValue();
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockImplementation(() =>
        Response.json({ ok: true, status: "ready", workflowId: "test" })
      )
  );
  const resolvedResult2 = await GET();
  expect(resolvedResult2.status).toBe(HTTP_STATUS.ok);
  expect(fetch).toHaveBeenCalledExactlyOnceWith(
    new URL("http://localhost:3790/eve/chat/v1/health"),
    expect.objectContaining({ cache: "no-store", redirect: "error" })
  );
  expect(timeout.mock.calls[0]?.[2]?.signal?.aborted).toBe(true);
  database.mockRejectedValue(new Error("database disconnected"));
  const resolvedResult3 = await GET();
  expect(resolvedResult3.status).toBe(HTTP_STATUS.serviceUnavailable);
  expect(timeout.mock.calls[1]?.[2]?.signal?.aborted).toBe(true);
});

test("bounds a stalled database check", async () => {
  database.mockReturnValue(Promise.withResolvers<never>().promise);
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockImplementation(() =>
        Response.json({ ok: true, status: "ready", workflowId: "test" })
      )
  );
  const resolvedResult4 = await GET();
  expect(resolvedResult4.status).toBe(HTTP_STATUS.serviceUnavailable);
}, 10_000);

const unavailableStatus = 503;
test("a failed shared worker makes the production instance unavailable", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: { readonly pathname: string }) => {
      if (url.pathname === "/eve/chat/v1/health") {
        throw new Error("shared process exited");
      }
      return Response.json({ ok: true, status: "ready", workflowId: "test" });
    })
  );
  const response = await GET();
  expect(response.status).toBe(unavailableStatus);
  expect(await response.json()).toEqual({ status: "unavailable" });
});
