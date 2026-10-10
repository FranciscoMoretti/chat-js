import { afterEach, expect, test, vi } from "vitest";

import { GET } from "./route";

const HTTP_STATUS = {
  ok: 200,
  serviceUnavailable: 503,
};

const STALLED_DATABASE_RESPONSE_ADVANCE_MS = 4500;

const database = vi.hoisted(() => vi.fn());
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
});
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */

/* oxlint-disable no-undefined -- Keep the mock's undefined result as the absent-database signal exercised by this route test. */
test("requires a genuine Eve health response, not a login page", async () => {
  database.mockResolvedValue(undefined);
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response("<html>login</html>"))
  );
  const resolvedResult1 = await GET();
  expect(resolvedResult1.status).toBe(HTTP_STATUS.serviceUnavailable);
});
/* oxlint-enable no-undefined */
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */

/* oxlint-disable no-undefined -- Keep the mocked missing database value distinct from null while testing readiness. */
test("reports ready only with database and Eve available", async () => {
  database.mockResolvedValue(undefined);
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
  database.mockRejectedValue(new Error("database disconnected"));
  const resolvedResult3 = await GET();
  expect(resolvedResult3.status).toBe(HTTP_STATUS.serviceUnavailable);
});
/* oxlint-enable no-undefined */
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */

test("bounds a stalled database check", async () => {
  vi.useFakeTimers();
  database.mockReturnValue(
    // oxlint-disable-next-line promise/avoid-new -- Bridge the readiness timer or never-settling test fixture to the awaited operation.
    new Promise(() => {
      // Leave the readiness check pending to exercise its timeout.
    })
  );
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockImplementation(() =>
        Response.json({ ok: true, status: "ready", workflowId: "test" })
      )
  );
  const response = GET();
  await vi.advanceTimersByTimeAsync(STALLED_DATABASE_RESPONSE_ADVANCE_MS);
  const resolvedResult4 = await response;
  expect(resolvedResult4.status).toBe(HTTP_STATUS.serviceUnavailable);
});
/* oxlint-enable oxc/no-async-await */

const unavailableStatus = 503;
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
test("a failed guest worker makes the production instance unavailable", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: { readonly pathname: string }) => {
      if (url.pathname === "/eve/guest/v1/health") {
        throw new Error("guest process exited");
      }
      return Response.json({ ok: true, status: "ready", workflowId: "test" });
    })
  );
  const response = await GET();
  expect(response.status).toBe(unavailableStatus);
  expect(await response.json()).toEqual({ status: "unavailable" });
});
/* oxlint-enable oxc/no-async-await */
