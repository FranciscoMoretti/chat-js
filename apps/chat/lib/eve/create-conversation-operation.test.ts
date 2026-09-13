// oxlint-disable-next-line eslint/max-classes-per-file -- Keep the related admission error variants alongside their shared query contract.
import { beforeEach, expect, it, vi } from "vitest";

import { createEveConversationOperation } from "./create-conversation-operation";

const mocks = vi.hoisted(() => ({
  creation: vi.fn(),
  readiness: vi.fn(),
  request: vi.fn(),
  reserve: vi.fn(),
  source: vi.fn(),
}));
vi.mock("./server", () => ({
  assertEveConfigured: vi.fn(),
  eveRequest: mocks.request,
}));
vi.mock("./checkpoint-readiness", () => ({
  waitForEveCheckpoint: mocks.readiness,
}));
vi.mock("@/lib/db/eve-queries", () => ({
  CreationConflictError: class extends Error {},
  CreationProjectNotFoundError: class extends Error {},
  createEveConversation: mocks.reserve,
  getEveConversation: mocks.source,
  getEveCreation: mocks.creation,
}));
vi.mock("@/lib/db/eve-guests", () => ({
  readEveGuestOwner: async () => {},
}));
vi.mock("@/lib/db/credits", () => ({ canSpend: () => Promise.resolve(true) }));
vi.mock("@/lib/db/eve-files", () => ({ assertEveFilesOwned: vi.fn() }));
vi.mock("./model-selection", () => ({ loadEveModelDefinition: vi.fn() }));
vi.mock("./prepare-message", () => ({
  prepareEveMessage: (message: string) => Promise.resolve(message),
}));
vi.mock("./reconcile-usage", () => ({ reconcileEveOwnerUsage: vi.fn() }));
const input = {
  fork: { beforeTurnId: "turn_0", conversationId: "source-chat" },
  message: "compare",
  modelId: "openai/gpt-4o",
  operationId: "ba1d7f02-597b-47a7-a8de-20f700500f0d",
};
beforeEach(() => {
  vi.resetAllMocks();
  mocks.source.mockResolvedValue({ sessionId: "source", state: "bound" });
  mocks.reserve.mockImplementation(
    async (_owner, operationId, _title, dispatch) => ({
      sessionId: await dispatch(operationId),
    })
  );
  mocks.request.mockImplementation((_owner, path) =>
    Promise.resolve(
      path.startsWith("/eve/v1/operation/")
        ? Response.json({ code: "eve_operation_not_found" }, { status: 404 })
        : Response.json({ sessionId: "child" })
    )
  );
});
it("does not allocate a native child before the initial checkpoint is ready", async () => {
  mocks.readiness.mockRejectedValue(new Error("pending"));
  const response = await createEveConversationOperation("owner", input);
  expect(response.status).toBe(409);
  expect(await response.json()).not.toHaveProperty("creationRejected");
  expect(mocks.request.mock.calls.map((call) => call[1])).toEqual([
    `/eve/v1/operation/${input.operationId}`,
  ]);
  mocks.readiness.mockResolvedValue(undefined);
  const retry = await createEveConversationOperation("owner", input);
  expect(await retry.json()).toEqual({ sessionId: "child" });
  expect(mocks.request.mock.calls.at(-1)?.[2].body).toContain(
    input.operationId
  );
  expect(mocks.request.mock.calls.at(-1)?.[2].body).toContain(
    '"beforeTurnId":"turn_0"'
  );
});
it("recovers an already allocated native operation without needing its checkpoint again", async () => {
  mocks.creation.mockResolvedValue({ state: "reserved" });
  mocks.request.mockResolvedValue(
    Response.json({ sessionId: "existing-child" })
  );
  const resolvedResult1 = await createEveConversationOperation("owner", input);
  expect(await resolvedResult1.json()).toEqual({ sessionId: "existing-child" });
  expect(mocks.readiness).not.toHaveBeenCalled();
  expect(mocks.request).toHaveBeenCalledOnce();
});
it("refuses a foreign or deleted source before reservation or checkpoint access", async () => {
  mocks.source.mockResolvedValue(undefined);
  const resolvedResult2 = await createEveConversationOperation(
    "stranger",
    input
  );
  expect(resolvedResult2.status).toBe(404);
  expect(mocks.reserve).not.toHaveBeenCalled();
  expect(mocks.readiness).not.toHaveBeenCalled();
  expect(mocks.request).not.toHaveBeenCalled();
});

it("passes the same named checkpoint to readiness and native fork allocation", async () => {
  const checkpointId = crypto.randomUUID();
  const named = { ...input, fork: { ...input.fork, checkpointId } };
  const resolvedResult3 = await createEveConversationOperation("owner", named);
  expect(resolvedResult3.status).toBe(200);
  expect(mocks.readiness).toHaveBeenCalledWith(
    "owner",
    "source",
    "turn_0",
    checkpointId
  );
  const body = JSON.parse(mocks.request.mock.calls.at(-1)?.[2].body);
  expect(body.fork).toEqual({
    beforeTurnId: "turn_0",
    checkpointId,
    sessionId: "source",
  });
});

it("rejects saved-copy operations before ordinary native lookup or dispatch", async () => {
  mocks.creation.mockResolvedValue({
    creationKind: "copy",
    state: "uncertain",
  });
  const response = await createEveConversationOperation("owner", input);
  expect(response.status).toBe(409);
  expect(await response.json()).toMatchObject({ creationRejected: true });
  expect(mocks.reserve).not.toHaveBeenCalled();
  expect(mocks.request).not.toHaveBeenCalled();
});

it("dispatches imported forks by message identity without requiring an execution checkpoint", async () => {
  const imported = {
    ...input,
    fork: { beforeMessageId: "seed_message_2", conversationId: "source-chat" },
  };
  const resolvedResult4 = await createEveConversationOperation(
    "owner",
    imported
  );
  expect(resolvedResult4.status).toBe(200);
  expect(mocks.readiness).not.toHaveBeenCalled();
  expect(JSON.parse(mocks.request.mock.calls.at(-1)?.[2].body).fork).toEqual({
    beforeMessageId: "seed_message_2",
    sessionId: "source",
  });
  mocks.creation.mockResolvedValue({ state: "uncertain" });
  mocks.request
    .mockClear()
    .mockResolvedValue(Response.json({ sessionId: "existing-child" }));
  const resolvedResult5 = await createEveConversationOperation(
    "owner",
    imported
  );
  expect(await resolvedResult5.json()).toEqual({ sessionId: "existing-child" });
  expect(mocks.request).toHaveBeenCalledOnce();
  expect(mocks.readiness).not.toHaveBeenCalled();
});

it("forwards selected tools on creation and includes them in the reservation identity", async () => {
  await createEveConversationOperation("owner", {
    ...input,
    selectedTool: "webSearch",
  });
  expect(mocks.request.mock.calls.at(-1)?.[4]).toBe("webSearch");
  const originalHash = mocks.reserve.mock.calls.at(-1)?.[4].initialContentHash;
  expect(originalHash).toBeTypeOf("string");
  await createEveConversationOperation("owner", {
    ...input,
    selectedTool: "deepResearch",
  });
  expect(mocks.reserve.mock.calls.at(-1)?.[4].initialContentHash).not.toBe(
    originalHash
  );
});
