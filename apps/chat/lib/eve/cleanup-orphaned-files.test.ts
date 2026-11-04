import { beforeEach, expect, test, vi } from "vitest";
import { cleanupEveOrphanedFiles } from "./cleanup-orphaned-files";
import type { prepareEveOrphanedFilePurge } from "@/lib/db/eve-orphaned-files";

const mocks = vi.hoisted(() => ({
  complete: vi.fn(),
  inventory: vi.fn(),
  prepare: vi.fn<typeof prepareEveOrphanedFilePurge>(),
  remove: vi.fn<() => Promise<void>>(),
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

const cutoff = new Date("2026-01-01");
const old = new Date("2025-12-31");
const key = "abcdefghijklmnopqrstuvwx.png";
beforeEach(() => {
  vi.resetAllMocks();
});
test("only submits old valid keys and deletes the ownership-filtered result", async () => {
  mocks.inventory.mockImplementation(function* fixtureOutput() {
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
  expect(mocks.remove).toHaveBeenCalledWith([`/api/files/${key}`]);
  expect(mocks.complete).toHaveBeenCalledWith("owner", [key]);
});
test("a failed batch retains its deletion fence without starving subsequent batches", async () => {
  const keys = Array.from({ length: 101 }, (_unused, fileIndex) =>
    String(fileIndex).padStart(24, "0")
  );
  mocks.inventory.mockImplementation(function* fixtureOutput() {
    for (const fileKey of keys) {
      yield { pathname: fileKey, uploadedAt: old };
    }
  });
  mocks.prepare
    .mockResolvedValueOnce(
      keys.slice(0, 100).map((fileKey) => ({ key: fileKey, ownerId: "owner" }))
    )
    .mockResolvedValueOnce([{ key: keys[100], ownerId: "owner" }]);
  mocks.remove
    .mockRejectedValueOnce(new Error("partial storage failure"))
    .mockResolvedValue();
  await expect(cleanupEveOrphanedFiles(cutoff)).rejects.toThrow("incomplete");

  expect(mocks.prepare.mock.calls).toEqual([
    [keys.slice(0, 100), cutoff],
    [keys.slice(100), cutoff],
  ]);
  expect(mocks.remove.mock.calls).toEqual([
    [keys.slice(0, 100).map((fileKey) => `/api/files/${fileKey}`)],
    [[`/api/files/${keys[100]}`]],
  ]);
  expect(mocks.complete).toHaveBeenCalledExactlyOnceWith("owner", [keys[100]]);
});
