import { beforeEach, expect, test, vi } from "vitest";
import { cleanupEveOrphanedFiles } from "./cleanup-orphaned-files";
import type { prepareEveOrphanedFilePurge } from "@/lib/db/eve-orphaned-files";

const mocks = vi.hoisted(() => ({
  complete: vi.fn(),
  inventory: vi.fn(),
  prepare: vi.fn<typeof prepareEveOrphanedFilePurge>(),
  remove: vi.fn(),
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
/* oxlint-disable typescript/promise-function-async --
 * typescript/promise-function-async (#606): beforeEach preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
beforeEach(() => {
  vi.resetAllMocks();
  mocks.prepare.mockImplementation((keys: readonly string[]) =>
    Promise.resolve(keys.map((fileKey) => ({ key: fileKey, ownerId: "owner" })))
  );
});
/* oxlint-disable oxc/no-async-await -- Await completion or rejection of the inventory sweep before asserting provider deletions and durable fence completion. */
/* oxlint-enable typescript/promise-function-async */
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Await completion or rejection of the inventory sweep before asserting provider deletions and durable fence completion. */
/* oxlint-disable no-magic-numbers, no-undefined --
 * no-magic-numbers (#517): test("a failed batch retains its deletion fence without starving subsequent batches") uses 24, 100, 1 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * no-undefined (#519): test("a failed batch retains its deletion fence without starving subsequent batches") uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 */
test("a failed batch retains its deletion fence without starving subsequent batches", async () => {
  const keys = Array.from({ length: 101 }, (_unused, fileIndex) =>
    String(fileIndex).padStart(24, "0")
  );
  mocks.inventory.mockImplementation(function* fixtureOutput() {
    for (const fileKey of keys) {
      yield { pathname: fileKey, uploadedAt: old };
    }
  });
  mocks.remove
    .mockRejectedValueOnce(new Error("partial storage failure"))
    .mockResolvedValue(undefined);
  await expect(cleanupEveOrphanedFiles(cutoff)).rejects.toThrow("incomplete");

  expect(
    mocks.prepare.mock.calls.map(
      ([fileKeys]: Readonly<(typeof mocks.prepare.mock.calls)[number]>) =>
        fileKeys.length
    )
  ).toEqual([100, 1]);
  expect(mocks.complete).toHaveBeenCalledExactlyOnceWith("owner", [keys[100]]);
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable no-magic-numbers, no-undefined */
