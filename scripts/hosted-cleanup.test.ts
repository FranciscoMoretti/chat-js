import { afterEach, expect, test, vi } from "vitest";

import { runHostedCleanup } from "./hosted-cleanup";

afterEach(() => vi.unstubAllGlobals());

const ok = 200;
const unavailable = 503;
const emptyBatch = 0;
const fullBatch = 5;
const lastGuest = 1;
const drainedRequests = 3;
const failedRequests = 2;
const batchLimit = 100;
const batch = (deletedCount: number): Response =>
  Response.json({
    results: {
      expiredGuests: { deletedCount, pendingCount: 0, skipped: false },
    },
    success: true,
  });

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test.each([   [ok, { success: false }],   [unavailable, { success: true }],   [ok, { results: {} }],'s awaited sequencing and rejected-Promise behavior. */
test.each([
  [ok, { success: false }],
  [unavailable, { success: true }],
  [ok, { results: {} }],
  [ok, { success: true }],
])(
  "rejects incomplete cleanup (%s)",
  async (
    status,
    body: Readonly<{
      success?: boolean;
      results?: Readonly<Record<string, never>>;
    }>
  ) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Response.json(body, { status }))
    );
    await expect(
      runHostedCleanup("https://chat.example", "secret")
    ).rejects.toThrow();
  }
);
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
test("sends credentials only to the configured HTTPS origin without redirects", async () => {
  const request = vi.fn(() => batch(emptyBatch));
  vi.stubGlobal("fetch", request);
  await runHostedCleanup("https://chat.example", "secret");
  expect(request).toHaveBeenCalledWith(
    new URL("https://chat.example/api/cron/cleanup"),
    expect.objectContaining({
      headers: { authorization: "Bearer secret" },
      redirect: "error",
    })
  );
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
test("drains multiple guest batches before reporting success", async () => {
  const request = vi
    .fn(() => batch(emptyBatch))
    .mockImplementationOnce(() => batch(fullBatch))
    .mockImplementationOnce(() => batch(lastGuest));
  vi.stubGlobal("fetch", request);
  await runHostedCleanup("https://chat.example", "secret");
  expect(request).toHaveBeenCalledTimes(drainedRequests);
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
test("fails when later cleanup work cannot complete", async () => {
  const request = vi
    .fn(() => Response.json({ success: false }, { status: unavailable }))
    .mockImplementationOnce(() => batch(fullBatch));
  vi.stubGlobal("fetch", request);
  await expect(
    runHostedCleanup("https://chat.example", "secret")
  ).rejects.toThrow();
  expect(request).toHaveBeenCalledTimes(failedRequests);
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
test("bounds a backlog that never drains", async () => {
  const request = vi.fn(() => batch(fullBatch));
  vi.stubGlobal("fetch", request);
  await expect(
    runHostedCleanup("https://chat.example", "secret")
  ).rejects.toThrow("batch limit");
  expect(request).toHaveBeenCalledTimes(batchLimit);
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test.each([   "http://chat.example",   "https://user:pass@chat.example",   "https://chat.example/pat's awaited sequencing and rejected-Promise behavior. */
test.each([
  "http://chat.example",
  "https://user:pass@chat.example",
  "https://chat.example/path",
])("refuses an unsafe scheduler target %s", async (origin) => {
  const request = vi.fn();
  vi.stubGlobal("fetch", request);
  await expect(runHostedCleanup(origin, "secret")).rejects.toThrow();
  expect(request).not.toHaveBeenCalled();
});
/* oxlint-enable oxc/no-async-await */
