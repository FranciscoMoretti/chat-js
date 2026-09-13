import { NextRequest } from "next/server";
import { beforeEach, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  env: {
    CRON_SECRET: "fixture-secret" as string | undefined,
    WORKFLOW_POSTGRES_URL: "postgresql://localhost/eve-test",
    EVE_ENABLED: "false",
  },
  references: vi.fn(),
  list: vi.fn(),
  remove: vi.fn(),
  cleanupEve: vi.fn(),
  cleanupGuests: vi.fn(),
}));
vi.mock("@/lib/env", () => ({
  env: mocks.env,
}));
vi.mock("@/lib/config", () => ({
  config: {
    ai: { tools: { image: { enabled: true } } },
    features: { attachments: true },
  },
}));
vi.mock("@/lib/db/queries", () => ({ getAllAttachmentUrls: mocks.references }));
vi.mock("@/lib/file-storage", () => ({
  deleteFilesByUrls: mocks.remove,
  listFiles: mocks.list,
}));
vi.mock("@/lib/eve/cleanup-orphaned-files", () => ({
  cleanupEveOrphanedFiles: mocks.cleanupEve,
}));

vi.mock("@/lib/eve/cleanup-expired-guests", () => ({
  cleanupExpiredEveGuests: mocks.cleanupGuests,
}));

import { GET } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.env.CRON_SECRET = "fixture-secret";
  mocks.cleanupEve.mockResolvedValue({ deletedCount: 0, skipped: false });
  mocks.cleanupGuests.mockResolvedValue({
    deletedCount: 0,
    pendingCount: 0,
    skipped: false,
  });
});

test.each([undefined, "", "   "])(
  "unconfigured cleanup rejects a matching interpolated credential: %j",
  async (secret) => {
    mocks.env.CRON_SECRET = secret;
    const response = await GET(
      new NextRequest("http://localhost/api/cron/cleanup", {
        headers: { authorization: `Bearer ${secret}` },
      })
    );
    expect(response.status).toBe(401);
    expect(mocks.references).not.toHaveBeenCalled();
    expect(mocks.list).not.toHaveBeenCalled();
    expect(mocks.remove).not.toHaveBeenCalled();
    expect(mocks.cleanupEve).not.toHaveBeenCalled();
    expect(mocks.cleanupGuests).not.toHaveBeenCalled();
  }
);

test("cleanup uses EVE ownership even while new EVE admission is disabled", async () => {
  const response = await GET(
    new NextRequest("http://localhost/api/cron/cleanup", {
      headers: { authorization: "Bearer fixture-secret" },
    })
  );
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    results: {
      orphanedAttachments: {
        deletedCount: 0,
        skipped: false,
      },
    },
  });
  expect(mocks.references).not.toHaveBeenCalled();
  expect(mocks.list).not.toHaveBeenCalled();
  expect(mocks.remove).not.toHaveBeenCalled();
  expect(mocks.cleanupEve).toHaveBeenCalledOnce();
  expect(mocks.cleanupEve.mock.calls[0]?.[0].getTime()).toBeLessThanOrEqual(
    Date.now() - 4 * 60 * 60 * 1000
  );
});

test("cleanup still requires cron authorization", async () => {
  const response = await GET(
    new NextRequest("http://localhost/api/cron/cleanup")
  );
  expect(response.status).toBe(401);
  expect(mocks.references).not.toHaveBeenCalled();
  expect(mocks.list).not.toHaveBeenCalled();
  expect(mocks.remove).not.toHaveBeenCalled();
});

test("storage failure does not prevent expired guest cleanup and reports retry", async () => {
  mocks.cleanupEve.mockRejectedValueOnce(new Error("storage unavailable"));
  const response = await GET(
    new NextRequest("http://localhost/api/cron/cleanup", {
      headers: { authorization: "Bearer fixture-secret" },
    })
  );
  expect(response.status).toBe(503);
  expect(mocks.cleanupGuests).toHaveBeenCalledWith(process.cwd());
  expect(await response.json()).toMatchObject({
    success: false,
    results: { expiredGuests: { pendingCount: 0 } },
  });
});

test("pending guest deletion is retryable failure after attachment cleanup runs", async () => {
  mocks.cleanupGuests.mockResolvedValueOnce({
    skipped: false,
    deletedCount: 1,
    pendingCount: 1,
  });
  const response = await GET(
    new NextRequest("http://localhost/api/cron/cleanup", {
      headers: { authorization: "Bearer fixture-secret" },
    })
  );
  expect(response.status).toBe(503);
  expect(mocks.cleanupEve).toHaveBeenCalledOnce();
  expect(await response.json()).toMatchObject({ success: false });
});
