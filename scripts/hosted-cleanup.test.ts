import { afterEach, expect, test, vi } from "vitest";

import { runHostedCleanup } from "../apps/chat/scripts/cleanup";

afterEach(() => vi.unstubAllGlobals());

const ok = 200;
const unavailable = 503;
const emptyBatch = 0;
const fullBatch = 5;
const lastGuest = 1;
const drainedRequests = 3;
const failedRequests = 2;
const batchLimit = 100;
const batch = (deletedCount: number, runtimeDeletedCount = 0): Response =>
  Response.json({
    results: {
      expiredGuests: { deletedCount, pendingCount: 0, skipped: false },
      runtimeGuests: {
        deletedCount: runtimeDeletedCount,
        pendingCount: 0,
        skipped: false,
      },
    },
    success: true,
  });

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
test("drains multiple guest batches before reporting success", async () => {
  const request = vi
    .fn(() => batch(emptyBatch))
    .mockImplementationOnce(() => batch(fullBatch))
    .mockImplementationOnce(() => batch(lastGuest));
  vi.stubGlobal("fetch", request);
  await runHostedCleanup("https://chat.example", "secret");
  expect(request).toHaveBeenCalledTimes(drainedRequests);
});
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
test("bounds a backlog that never drains", async () => {
  const request = vi.fn(() => batch(fullBatch));
  vi.stubGlobal("fetch", request);
  await expect(
    runHostedCleanup("https://chat.example", "secret")
  ).rejects.toThrow("batch limit");
  expect(request).toHaveBeenCalledTimes(batchLimit);
});
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

test("drains runtime guest batches even when legacy inventory is empty", async () => {
  const request = vi
    .fn(() => batch(0))
    .mockImplementationOnce(() => batch(0, 5))
    .mockImplementationOnce(() => batch(0, 2));
  vi.stubGlobal("fetch", request);
  await runHostedCleanup("https://chat.example", "secret");
  expect(request).toHaveBeenCalledTimes(3);
});
test("runtime guest cooldown backlog cannot report a successful drain", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Response.json({
        success: true,
        results: {
          expiredGuests: { deletedCount: 0, pendingCount: 0, skipped: false },
          runtimeGuests: { deletedCount: 0, pendingCount: 1, skipped: false },
        },
      })
    )
  );
  await expect(
    runHostedCleanup("https://chat.example", "secret")
  ).rejects.toThrow("inventory unavailable");
});

test("drains an explicitly partial backlog but never reports a stalled sweep as success", async () => {
  const request = vi
    .fn(() => batch(0))
    .mockImplementationOnce(() =>
      Response.json(
        {
          success: false,
          results: {
            orphanedAttachments: { deletedCount: 0, skipped: false },
            expiredGuests: { deletedCount: 0, pendingCount: 0, skipped: false },
            runtimeGuests: { deletedCount: 5, pendingCount: 3, skipped: false },
          },
        },
        { status: 503 }
      )
    );
  vi.stubGlobal("fetch", request);
  await runHostedCleanup("https://chat.example", "secret");
  expect(request).toHaveBeenCalledTimes(2);
});
