import { beforeEach, expect, test, vi } from "vitest";

import { purgeEveFamilyFiles } from "./purge-files";

const mocks = vi.hoisted(() => ({
  complete: vi.fn(),
  prepare: vi.fn(),
  release: vi.fn(),
  remove: vi.fn(),
}));
vi.mock("../db/eve-file-purge", () => ({
  completeEveFilePurge: mocks.complete,
  prepareEveFamilyFilePurge: mocks.prepare,
  releaseEveFamilyFileReferences: mocks.release,
}));
vi.mock("../file-storage", () => ({ deleteFilesByUrls: mocks.remove }));

beforeEach(() => vi.resetAllMocks());
test("failed storage removal leaves the durable deletion pending for retry", async () => {
  const keys = ["abcdefghijklmnopqrstuvwx.png"];
  mocks.prepare.mockResolvedValue(keys);
  mocks.remove.mockRejectedValueOnce(new Error("storage unavailable"));
  await expect(purgeEveFamilyFiles("owner", "root")).rejects.toThrow(
    "storage unavailable"
  );
  expect(mocks.complete).not.toHaveBeenCalled();
  expect(mocks.release).not.toHaveBeenCalled();
  await purgeEveFamilyFiles("owner", "root");
  expect(mocks.remove).toHaveBeenLastCalledWith([
    "/api/files/content?key=abcdefghijklmnopqrstuvwx.png",
  ]);
  expect(mocks.complete).toHaveBeenCalledWith("owner", keys);
  expect(mocks.release).toHaveBeenCalledWith("owner", "root");
});
test("a completed or fully shared file set does not access storage", async () => {
  mocks.prepare.mockResolvedValue([]);
  await purgeEveFamilyFiles("owner", "root");
  expect(mocks.release).toHaveBeenCalledWith("owner", "root");
  expect(mocks.remove).not.toHaveBeenCalled();
  expect(mocks.complete).not.toHaveBeenCalled();
});
