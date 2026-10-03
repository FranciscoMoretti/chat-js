import { afterEach, expect, test, vi } from "vitest";

import { GET } from "./route";

const database = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db/health", () => ({ checkDatabase: database }));
vi.mock("@/lib/env", () => ({
  env: {
    EVE_INTERNAL_ORIGIN: "http://localhost:3790",
    NODE_ENV: "development",
  },
}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.resetAllMocks();
});
/* oxlint-disable no-magic-numbers, no-undefined --
 * no-magic-numbers (#517): test("requires a genuine Eve health response, not a login page") uses 503 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * no-undefined (#519): test("requires a genuine Eve health response, not a login page") uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 */
test("requires a genuine Eve health response, not a login page", async () => {
  database.mockResolvedValue(undefined);
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response("<html>login</html>"))
  );
  const resolvedResult1 = await GET();
  expect(resolvedResult1.status).toBe(503);
});
/* oxlint-enable no-magic-numbers, no-undefined */
/* oxlint-disable no-magic-numbers, no-undefined --
 * no-magic-numbers (#517): test("reports ready only with database and Eve available") uses 200, 503 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * no-undefined (#519): test("reports ready only with database and Eve available") uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 */
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
/* oxlint-enable no-magic-numbers, no-undefined */
/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): test("bounds a stalled database check") uses 4500, 503 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
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
      .mockResolvedValue(
        Response.json({ ok: true, status: "ready", workflowId: "test" })
      )
  );
  const response = GET();
  await vi.advanceTimersByTimeAsync(4500);
  const resolvedResult4 = await response;
  expect(resolvedResult4.status).toBe(503);
});
/* oxlint-enable no-magic-numbers */
