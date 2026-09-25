import { beforeEach, expect, test, vi } from "vitest";

import { eveGeneratedFileUploader } from "./generated-files";

const mocks = vi.hoisted(() => ({
  reserve: vi.fn(),
  resolve: vi.fn(),
  upload: vi.fn(),
  write: vi.fn(),
}));
vi.mock("../db/eve-files", () => ({
  reserveEveGeneratedFile: mocks.reserve,
  writeEveGeneratedFile: mocks.write,
}));
vi.mock("../file-storage", () => ({
  createFileId: () => "abcdefghijklmnopqrstuvwx.png",
  uploadFileAtKey: mocks.upload,
}));
vi.mock("./conversation-scope", () => ({
  resolveEveConversationScope: mocks.resolve,
}));

beforeEach(() => {
  vi.resetAllMocks();
  mocks.resolve.mockResolvedValue({
    conversationId: "conversation",
    ownerId: "owner",
  });
  mocks.write.mockImplementation(
    (_owner, _conversation, _key, write: () => Promise<unknown>) => write()
  );
  mocks.upload.mockResolvedValue({ url: "fixture-url" });
});
const context = (signal = new AbortController().signal) => ({
  abortSignal: signal,
  session: { auth: { initiator: { principalId: "owner" } }, id: "session" },
});
test("reserves a recoverable key and enters the deletion lock before external upload", async () => {
  await expect(
    eveGeneratedFileUploader(context())("image.png", "bytes", "image/png")
  ).resolves.toEqual({ url: "fixture-url" });
  expect(mocks.reserve).toHaveBeenCalledWith(
    "owner",
    "conversation",
    "abcdefghijklmnopqrstuvwx.png"
  );
  expect(mocks.reserve.mock.invocationCallOrder[0]).toBeLessThan(
    mocks.write.mock.invocationCallOrder[0]
  );
  expect(mocks.write.mock.invocationCallOrder[0]).toBeLessThan(
    mocks.upload.mock.invocationCallOrder[0]
  );
});
test("reservation failure and cancellation prevent external upload", async () => {
  mocks.reserve.mockRejectedValueOnce(new Error("deleting"));
  await expect(
    eveGeneratedFileUploader(context())("image.png", "bytes")
  ).rejects.toThrow("deleting");
  expect(mocks.upload).not.toHaveBeenCalled();
  await expect(
    eveGeneratedFileUploader(context(AbortSignal.abort()))("image.png", "bytes")
  ).rejects.toThrow();
  expect(mocks.upload).not.toHaveBeenCalled();
});
