import { beforeEach, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prepare: vi.fn(),
  complete: vi.fn(),
  remove: vi.fn(),
}));
vi.mock("../db/eve-file-purge", () => ({
  prepareEveFamilyFilePurge: mocks.prepare,
  completeEveFilePurge: mocks.complete,
}));
vi.mock("../file-storage", () => ({ deleteFilesByUrls: mocks.remove }));

import { purgeEveFamilyFiles } from "./purge-files";

beforeEach(() => vi.resetAllMocks());
test("failed storage removal leaves the durable deletion pending for retry", async () => {
  const keys = ["abcdefghijklmnopqrstuvwx.png"];
  mocks.prepare.mockResolvedValue(keys);
  mocks.remove.mockRejectedValueOnce(new Error("storage unavailable"));
  await expect(purgeEveFamilyFiles("owner", "root")).rejects.toThrow(
    "storage unavailable"
  );
  expect(mocks.complete).not.toHaveBeenCalled();
  await purgeEveFamilyFiles("owner", "root");
  expect(mocks.remove).toHaveBeenLastCalledWith([
    "/api/files/content?key=abcdefghijklmnopqrstuvwx.png",
  ]);
  expect(mocks.complete).toHaveBeenCalledWith("owner", keys);
});
test("a completed or fully shared file set does not access storage", async () => {
  mocks.prepare.mockResolvedValue([]);
  await purgeEveFamilyFiles("owner", "root");
  expect(mocks.remove).not.toHaveBeenCalled();
  expect(mocks.complete).not.toHaveBeenCalled();
});
