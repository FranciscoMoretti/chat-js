import { NextRequest } from "next/server";
import { beforeEach, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  references: vi.fn(),
  list: vi.fn(),
  remove: vi.fn(),
}));
vi.mock("@/lib/env", () => ({
  env: {
    CRON_SECRET: "fixture-secret",
    WORKFLOW_POSTGRES_URL: "postgresql://localhost/eve-test",
    EVE_ENABLED: "false",
  },
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

import { GET } from "./route";

beforeEach(() => vi.clearAllMocks());

test("legacy cleanup cannot erase EVE files even while new EVE admission is disabled", async () => {
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
        skipped: true,
        reason: "eve_file_inventory_pending",
      },
    },
  });
  expect(mocks.references).not.toHaveBeenCalled();
  expect(mocks.list).not.toHaveBeenCalled();
  expect(mocks.remove).not.toHaveBeenCalled();
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
