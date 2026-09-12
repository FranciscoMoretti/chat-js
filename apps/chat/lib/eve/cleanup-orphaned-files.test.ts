import { beforeEach, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prepare: vi.fn(),
  complete: vi.fn(),
  remove: vi.fn(),
  inventory: vi.fn(),
}));
vi.mock("../db/eve-orphaned-files", () => ({
  prepareEveOrphanedFilePurge: mocks.prepare,
}));
vi.mock("../db/eve-file-purge", () => ({
  completeEveFilePurge: mocks.complete,
}));
vi.mock("../file-storage", () => ({
  deleteFilesByUrls: mocks.remove,
  iterateStoredFiles: mocks.inventory,
}));

import { cleanupEveOrphanedFiles } from "./cleanup-orphaned-files";

const cutoff = new Date("2026-01-01");
const old = new Date("2025-12-31");
const key = "abcdefghijklmnopqrstuvwx.png";
beforeEach(() => {
  vi.resetAllMocks();
  mocks.prepare.mockImplementation(async (keys: string[]) =>
    keys.map((key) => ({ key, ownerId: "owner" }))
  );
});
test("only submits old valid keys and deletes the ownership-filtered result", async () => {
  mocks.inventory.mockImplementation(function* () {
    yield {
      pathname: key,
      uploadedAt: old,
      url: "https://untrusted.invalid/file",
    };
    yield { pathname: "legacy-file", uploadedAt: old };
    yield {
      pathname: "012345678901234567890123",
      uploadedAt: new Date("2026-01-02"),
    };
    yield {
      pathname: "112345678901234567890123",
      uploadedAt: new Date("invalid"),
    };
  });
  mocks.prepare.mockResolvedValue([]);
  expect(await cleanupEveOrphanedFiles(cutoff)).toEqual({
    deletedCount: 0,
    skipped: false,
  });
  expect(mocks.prepare).toHaveBeenCalledExactlyOnceWith([key], cutoff);
  expect(mocks.remove).not.toHaveBeenCalled();
  mocks.prepare.mockResolvedValue([{ key, ownerId: "owner" }]);
  expect(await cleanupEveOrphanedFiles(cutoff)).toEqual({
    deletedCount: 1,
    skipped: false,
  });
  expect(mocks.remove).toHaveBeenCalledWith([`/api/files/content?key=${key}`]);
  expect(mocks.complete).toHaveBeenCalledWith("owner", [key]);
});
test("a failed batch retains its deletion fence without starving subsequent batches", async () => {
  const keys = Array.from({ length: 101 }, (_, i) =>
    String(i).padStart(24, "0")
  );
  mocks.inventory.mockImplementation(function* () {
    for (const key of keys) {
      yield { pathname: key, uploadedAt: old };
    }
  });
  mocks.remove
    .mockRejectedValueOnce(new Error("partial storage failure"))
    .mockResolvedValue(undefined);
  await expect(cleanupEveOrphanedFiles(cutoff)).rejects.toThrow("incomplete");
  expect(mocks.prepare.mock.calls.map(([keys]) => keys.length)).toEqual([
    100, 1,
  ]);
  expect(mocks.complete).toHaveBeenCalledExactlyOnceWith("owner", [keys[100]]);
});
