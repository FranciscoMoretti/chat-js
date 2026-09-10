import { afterEach, expect, test, vi } from "vitest";

const database = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db/health", () => ({ checkDatabase: database }));
vi.mock("@/lib/env", () => ({
  env: {
    NODE_ENV: "development",
    EVE_INTERNAL_ORIGIN: "http://localhost:3790",
  },
}));
vi.mock("@/lib/eve/availability", () => ({ isEveEnabled: () => true }));

import { GET } from "./route";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.resetAllMocks();
});
test("requires a genuine Eve health response, not a login page", async () => {
  database.mockResolvedValue(undefined);
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response("<html>login</html>"))
  );
  expect((await GET()).status).toBe(503);
});
test("reports ready only with database and Eve available", async () => {
  database.mockResolvedValue(undefined);
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        Response.json({ ok: true, status: "ready", workflowId: "test" })
      )
  );
  expect((await GET()).status).toBe(200);
  database.mockRejectedValue(new Error("database disconnected"));
  expect((await GET()).status).toBe(503);
});
test("bounds a stalled database check", async () => {
  vi.useFakeTimers();
  database.mockReturnValue(new Promise(() => undefined));
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        Response.json({ ok: true, status: "ready", workflowId: "test" })
      )
  );
  const response = GET();
  await vi.advanceTimersByTimeAsync(4500);
  expect((await response).status).toBe(503);
});
