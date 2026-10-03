import { beforeEach, expect, test, vi } from "vitest";

import { recoverEveCreations } from "./recover-creations";

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
  pending: vi.fn(),
  read: vi.fn(),
}));
vi.mock("../db/eve-queries", () => ({
  getEveCreation: mocks.read,
  listPendingEveCreations: mocks.pending,
}));
vi.mock("./execute-conversation-creation", () => ({
  executeEveConversationCreation: mocks.execute,
}));
const operationId = "00000000-0000-4000-8000-000000000001";
beforeEach(() => {
  vi.resetAllMocks();
  mocks.pending.mockResolvedValue([
    { initialRequest: { message: "saved", operationId }, operationId },
  ]);
  mocks.execute.mockResolvedValue(
    Response.json({ code: "creation_in_progress" }, { status: 409 })
  );
});
/* oxlint-disable no-magic-numbers  --
 * no-magic-numbers (#517): test("waits for a concurrent binding without dispatching the operation again") uses 1 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * oxc/no-async-await (#540): test("waits for a concurrent binding without dispatching the operation again") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 */
test("waits for a concurrent binding without dispatching the operation again", async () => {
  mocks.read.mockResolvedValue({ sessionId: "native-session", state: "bound" });
  await expect(recoverEveCreations("owner")).resolves.toBeUndefined();
  expect(mocks.execute).toHaveBeenCalledTimes(1);
  expect(mocks.read).toHaveBeenCalledWith("owner", operationId);
});
/* oxlint-enable no-magic-numbers */
test("does not hide unrelated conflicts behind concurrent recovery", async () => {
  mocks.execute.mockResolvedValue(
    Response.json({ code: "creation_conflict" }, { status: 409 })
  );
  await expect(recoverEveCreations("owner")).rejects.toThrow(
    "still being recovered"
  );
  expect(mocks.read).not.toHaveBeenCalled();
});
/* oxlint-disable no-magic-numbers, unicorn/no-null  --
 * no-magic-numbers (#517): test("keeps admission closed when the bounded wait cannot prove a binding") uses 8, 1 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * oxc/no-async-await (#540): test("keeps admission closed when the bounded wait cannot prove a binding") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * unicorn/no-null (#570): test("keeps admission closed when the bounded wait cannot prove a binding") preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
test("keeps admission closed when the bounded wait cannot prove a binding", async () => {
  mocks.read.mockResolvedValue({ sessionId: null, state: "uncertain" });
  await expect(recoverEveCreations("owner")).rejects.toThrow(
    "still being recovered"
  );
  expect(mocks.read).toHaveBeenCalledTimes(8);
  expect(mocks.execute).toHaveBeenCalledTimes(1);
});
/* oxlint-enable no-magic-numbers, unicorn/no-null */

/* oxlint-disable unicorn/no-null  --
 * oxc/no-async-await (#540): test("never reconstructs an admitted command from historical columns") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * unicorn/no-null (#570): test("never reconstructs an admitted command from historical columns") preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
test("never reconstructs an admitted command from historical columns", async () => {
  mocks.pending.mockResolvedValue([
    {
      firstMessage: "historical message",
      initialContentHash: null,
      initialRequest: null,
      operationId,
    },
  ]);
  await expect(recoverEveCreations("owner")).rejects.toThrow(
    "still being recovered"
  );
  expect(mocks.execute).not.toHaveBeenCalled();
});
/* oxlint-enable unicorn/no-null */
