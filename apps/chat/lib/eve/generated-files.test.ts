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
  createFileId: (): string => "abcdefghijklmnopqrstuvwx.png",
  uploadFileAtKey: mocks.upload,
}));

vi.mock("./conversation-scope", () => ({
  resolveEveConversationScope: mocks.resolve,
}));

/* oxlint-disable max-params, typescript/promise-function-async --
 * max-params (#511): The writeEveGeneratedFile mock preserves the native four-argument callback position (owner, conversation, key, write).
 * typescript/promise-function-async (#606): This mock directly forwards the upload callback promise; making it async introduces the conflicting oxc/no-async-await rule.
 */
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
/* oxlint-enable max-params, typescript/promise-function-async */

const context = (
  signal: Readonly<AbortSignal> = new AbortController().signal
): {
  abortSignal: Readonly<AbortSignal>;
  session: { auth: { initiator: { principalId: string } }; id: string };
} => ({
  abortSignal: signal,
  session: { auth: { initiator: { principalId: "owner" } }, id: "session" },
});
/* oxlint-disable oxc/no-async-await -- Await the uploader or its rejection before checking reservation, durable-write and storage ordering. */

/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): test("reserves a recoverable key and enters the deletion lock before external upload" uses 0 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Await the uploader or its rejection before checking reservation, durable-write and storage ordering. */
/* oxlint-enable no-magic-numbers */

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
/* oxlint-enable oxc/no-async-await */
