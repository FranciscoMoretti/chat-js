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
test("waits for a concurrent binding without dispatching the operation again", async () => {
  mocks.read.mockResolvedValue({ sessionId: "native-session", state: "bound" });
  await expect(recoverEveCreations("owner")).resolves.toBeUndefined();
  expect(mocks.execute).toHaveBeenCalledTimes(1);
  expect(mocks.read).toHaveBeenCalledWith("owner", operationId);
});
test("does not hide unrelated conflicts behind concurrent recovery", async () => {
  mocks.execute.mockResolvedValue(
    Response.json({ code: "creation_conflict" }, { status: 409 })
  );
  await expect(recoverEveCreations("owner")).rejects.toThrow(
    "still being recovered"
  );
  expect(mocks.read).not.toHaveBeenCalled();
});
test("keeps admission closed when the bounded wait cannot prove a binding", async () => {
  mocks.read.mockResolvedValue({ sessionId: null, state: "uncertain" });
  await expect(recoverEveCreations("owner")).rejects.toThrow(
    "still being recovered"
  );
  expect(mocks.read).toHaveBeenCalledTimes(8);
  expect(mocks.execute).toHaveBeenCalledTimes(1);
});
