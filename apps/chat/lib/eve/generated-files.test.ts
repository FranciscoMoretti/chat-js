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
 * max-params (#511): beforeEach keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * typescript/promise-function-async (#606): beforeEach preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
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
/* oxlint-disable typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types --
 * typescript/explicit-function-return-type (#560): Keep context's return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): context accepts signal = new AbortController().signal; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 */
const context = (signal = new AbortController().signal) => ({
  abortSignal: signal,
  session: { auth: { initiator: { principalId: "owner" } }, id: "session" },
});
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types */
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
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-magic-numbers */
/* oxlint-disable unicorn/max-nested-calls --
 * unicorn/max-nested-calls (#568): test("reservation failure and cancellation prevent external upload") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 */
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable unicorn/max-nested-calls */
