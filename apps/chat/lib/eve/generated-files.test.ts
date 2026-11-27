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
  withEveConversationFile: mocks.write,
}));

vi.mock("../file-storage", () => ({
  createFileId: (): string => "abcdefghijklmnopqrstuvwx.png",
  uploadFileAtKey: mocks.upload,
}));

vi.mock("./conversation-scope", () => ({
  resolveEveConversationScope: mocks.resolve,
}));

beforeEach(() => {
  vi.resetAllMocks();
  mocks.resolve.mockResolvedValue({
    branchId: "conversation",
    ownerId: "owner",
  });
  mocks.write.mockImplementation(
    async (_owner, _conversation, _key, write: () => Promise<unknown>) =>
      await write()
  );
  mocks.upload.mockResolvedValue({ url: "fixture-url" });
});

const context = (
  signal: Readonly<AbortSignal> = new AbortController().signal
): {
  abortSignal: Readonly<AbortSignal>;
  session: { auth: { initiator: { principalId: string } }; id: string };
} => ({
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
  const abortedUploader = eveGeneratedFileUploader(
    context(AbortSignal.abort())
  );
  await expect(abortedUploader("image.png", "bytes")).rejects.toThrow();
  expect(mocks.upload).not.toHaveBeenCalled();
});

const publish = async (idempotencyKey: string) =>
  await eveGeneratedFileUploader(context(), { idempotencyKey })(
    "report.md",
    "# Report",
    "text/plain"
  );

test("reuses a file reservation on retry and separates distinct publication calls", async () => {
  await publish("research:first");
  await publish("research:first");
  await publish("research:second");
  const [first, retry, separate] = mocks.reserve.mock.calls;
  expect(first).toEqual([
    "owner",
    "conversation",
    expect.stringMatching(/^[a-zA-Z0-9_-]{24}$/u),
    { reuse: true },
  ]);
  expect(retry).toEqual(first);
  expect(separate[2]).not.toBe(first[2]);
});
