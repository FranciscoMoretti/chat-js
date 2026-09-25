import { afterEach, expect, test, vi } from "vitest";

import { GET } from "./route";

const database = vi.hoisted(() => vi.fn());
const settings = vi.hoisted(() => ({
  APP_URL: "http://localhost:3000",
  CHATJS_GUEST_ONLY: false,
  EVE_INTERNAL_ORIGIN: "http://localhost:3790",
  NODE_ENV: "development",
}));
vi.mock("@/lib/db/health", () => ({ checkDatabase: database }));
vi.mock("@/lib/env", () => ({ env: settings }));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.resetAllMocks();
  settings.CHATJS_GUEST_ONLY = false;
});
test("requires a genuine Eve health response, not a login page", async () => {
  database.mockResolvedValue(undefined);
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response("<html>login</html>"))
  );
  const resolvedResult1 = await GET();
  expect(resolvedResult1.status).toBe(503);
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
  const resolvedResult2 = await GET();
  expect(resolvedResult2.status).toBe(200);
  database.mockRejectedValue(new Error("database disconnected"));
  const resolvedResult3 = await GET();
  expect(resolvedResult3.status).toBe(503);
});
test("bounds a stalled database check", async () => {
  vi.useFakeTimers();
  // oxlint-disable-next-line promise/avoid-new -- Bridge the readiness timer or never-settling test fixture to the awaited operation.
  database.mockReturnValue(new Promise(() => {}));
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
  const resolvedResult4 = await response;
  expect(resolvedResult4.status).toBe(503);
});

test("guest-only readiness probes the guest agent without touching the database", async () => {
  settings.CHATJS_GUEST_ONLY = true;
  database.mockRejectedValue(new Error("No database configured"));
  const fetcher = vi
    .fn()
    .mockResolvedValue(
      Response.json({ ok: true, status: "ready", workflowId: "guest" })
    );
  vi.stubGlobal("fetch", fetcher);
  const response = await GET();
  expect(response.status).toBe(200);
  expect(database).not.toHaveBeenCalled();
  expect(String(fetcher.mock.calls[0][0])).toBe(
    "http://localhost:3000/eve/guest/v1/health"
  );
  fetcher.mockResolvedValue(new Response(null, { status: 503 }));
  const unavailable = await GET();
  expect(unavailable.status).toBe(503);
});
