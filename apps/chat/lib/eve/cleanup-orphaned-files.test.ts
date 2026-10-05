import { beforeEach, expect, test, vi } from "vitest";

import { cleanupEveOrphanedFiles } from "./cleanup-orphaned-files";

const mocks = vi.hoisted(() => ({
  complete: vi.fn(),
  inventory: vi.fn(),
  prepare: vi.fn(),
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
/* oxlint-disable typescript/prefer-readonly-parameter-types, typescript/promise-function-async --
 * typescript/prefer-readonly-parameter-types (#565): beforeEach accepts keys: string[]; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): beforeEach preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
beforeEach(() => {
  vi.resetAllMocks();
  mocks.prepare.mockImplementation((keys: string[]) =>
    Promise.resolve(keys.map((fileKey) => ({ key: fileKey, ownerId: "owner" })))
  );
});
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable typescript/prefer-readonly-parameter-types, typescript/promise-function-async */
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
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable id-length, no-magic-numbers, no-undefined, typescript/prefer-readonly-parameter-types --
 * id-length (#506): test("a failed batch retains its deletion fence without starving subsequent batches") uses _; i as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology.
 * no-magic-numbers (#517): test("a failed batch retains its deletion fence without starving subsequent batches") uses 24, 100, 1 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * no-undefined (#519): test("a failed batch retains its deletion fence without starving subsequent batches") uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * typescript/prefer-readonly-parameter-types (#565): test("a failed batch retains its deletion fence without starving subsequent batches") accepts [fileKeys]; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 */
test("a failed batch retains its deletion fence without starving subsequent batches", async () => {
  const keys = Array.from({ length: 101 }, (_, i) =>
    String(i).padStart(24, "0")
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
  // oxlint-disable-next-line typescript/no-unsafe-return, typescript/no-unsafe-member-access -- #598: This cleanup-orphaned-files fixture inspects controlled mock or JSON payloads; fully modeling the mock boundary requires a separate test-contract migration. #597: This cleanup-orphaned-files fixture inspects controlled mock or JSON payloads; fully modeling the mock boundary requires a separate test-contract migration.
  expect(mocks.prepare.mock.calls.map(([fileKeys]) => fileKeys.length)).toEqual(
    [100, 1]
  );
  expect(mocks.complete).toHaveBeenCalledExactlyOnceWith("owner", [keys[100]]);
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable id-length, no-magic-numbers, no-undefined, typescript/prefer-readonly-parameter-types */
