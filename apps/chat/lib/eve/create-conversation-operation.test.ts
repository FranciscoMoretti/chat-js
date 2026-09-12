import { beforeEach, expect, it, vi } from "vitest";
import { createEveConversationOperation } from "./create-conversation-operation";

const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  readiness: vi.fn(),
  source: vi.fn(),
  creation: vi.fn(),
  reserve: vi.fn(),
}));
vi.mock("./server", () => ({
  assertEveConfigured: vi.fn(),
  eveRequest: mocks.request,
}));
vi.mock("./checkpoint-readiness", () => ({
  waitForEveCheckpoint: mocks.readiness,
}));
vi.mock("@/lib/db/eve-queries", () => ({
  CreationConflict: class extends Error {},
  CreationProjectNotFound: class extends Error {},
  getEveConversation: mocks.source,
  getEveCreation: mocks.creation,
  createEveConversation: mocks.reserve,
}));
vi.mock("@/lib/db/credits", () => ({ canSpend: async () => true }));
vi.mock("@/lib/db/eve-files", () => ({ assertEveFilesOwned: vi.fn() }));
vi.mock("./model-selection", () => ({ loadEveModelDefinition: vi.fn() }));
vi.mock("./prepare-message", () => ({
  prepareEveMessage: async (message: string) => message,
}));
vi.mock("./reconcile-usage", () => ({ reconcileEveOwnerUsage: vi.fn() }));
const input = {
  operationId: "ba1d7f02-597b-47a7-a8de-20f700500f0d",
  modelId: "openai/gpt-4o",
  message: "compare",
  fork: { conversationId: "source-chat", beforeTurnId: "turn_0" },
};
beforeEach(() => {
  vi.resetAllMocks();
  mocks.source.mockResolvedValue({ sessionId: "source", state: "bound" });
  mocks.reserve.mockImplementation(
    async (_owner, operationId, _title, dispatch) => ({
      sessionId: await dispatch(operationId),
    })
  );
  mocks.request.mockImplementation(async (_owner, path) =>
    path.startsWith("/eve/v1/operation/")
      ? Response.json({ code: "eve_operation_not_found" }, { status: 404 })
      : Response.json({ sessionId: "child" })
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
  expect(
    await (await createEveConversationOperation("owner", input)).json()
  ).toEqual({ sessionId: "existing-child" });
  expect(mocks.readiness).not.toHaveBeenCalled();
  expect(mocks.request).toHaveBeenCalledOnce();
});
it("refuses a foreign or deleted source before reservation or checkpoint access", async () => {
  mocks.source.mockResolvedValue(undefined);
  expect((await createEveConversationOperation("stranger", input)).status).toBe(
    404
  );
  expect(mocks.reserve).not.toHaveBeenCalled();
  expect(mocks.readiness).not.toHaveBeenCalled();
  expect(mocks.request).not.toHaveBeenCalled();
});

it("passes the same named checkpoint to readiness and native fork allocation", async () => {
  const checkpointId = crypto.randomUUID();
  const named = { ...input, fork: { ...input.fork, checkpointId } };
  expect((await createEveConversationOperation("owner", named)).status).toBe(
    200
  );
  expect(mocks.readiness).toHaveBeenCalledWith(
    "owner",
    "source",
    "turn_0",
    checkpointId
  );
  const body = JSON.parse(mocks.request.mock.calls.at(-1)?.[2].body);
  expect(body.fork).toEqual({
    sessionId: "source",
    beforeTurnId: "turn_0",
    checkpointId,
  });
});

it("rejects saved-copy operations before ordinary native lookup or dispatch", async () => {
  mocks.creation.mockResolvedValue({
    state: "uncertain",
    creationKind: "copy",
  });
  const response = await createEveConversationOperation("owner", input);
  expect(response.status).toBe(409);
  expect(await response.json()).toMatchObject({ creationRejected: true });
  expect(mocks.reserve).not.toHaveBeenCalled();
  expect(mocks.request).not.toHaveBeenCalled();
});
