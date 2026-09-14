import { NextRequest } from "next/server";
import { beforeEach, expect, test, vi } from "vitest";

import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  cleanupEve: vi.fn(),
  cleanupGuests: vi.fn(),
  env: {
    CRON_SECRET: "fixture-secret" as string | undefined,

    WORKFLOW_POSTGRES_URL: "postgresql://localhost/eve-test",
  },
}));
vi.mock("@/lib/env", () => ({
  env: mocks.env,
}));
vi.mock("@/lib/eve/cleanup-orphaned-files", () => ({
  cleanupEveOrphanedFiles: mocks.cleanupEve,
}));

vi.mock("@/lib/eve/cleanup-expired-guests", () => ({
  cleanupExpiredEveGuests: mocks.cleanupGuests,
}));

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

    expect(mocks.cleanupEve).not.toHaveBeenCalled();
    expect(mocks.cleanupGuests).not.toHaveBeenCalled();
  }
);

test("cleanup uses EVE ownership", async () => {
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
    results: { expiredGuests: { pendingCount: 0 } },
    success: false,
  });
});

test("pending guest deletion is retryable failure after attachment cleanup runs", async () => {
  mocks.cleanupGuests.mockResolvedValueOnce({
    deletedCount: 1,
    pendingCount: 1,
    skipped: false,
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
