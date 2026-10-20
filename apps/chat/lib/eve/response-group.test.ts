import { beforeEach, expect, it, vi } from "vitest";

import { createEveResponseGroup } from "./response-group";
import { eveResponseGroupCandidates } from "./response-group-candidates";
import type { createEveConversationOperation } from "./create-conversation-operation";

const mocks = vi.hoisted(() => ({
  create: vi.fn<typeof createEveConversationOperation>(),
  refund: vi.fn(),
  reserve: vi.fn(),
  settle: vi.fn(),
}));
vi.mock("../db/eve-guests", () => ({ releaseEveGuestCreation: mocks.refund }));
vi.mock("../db/eve-response-groups", () => ({
  recordEveResponseGroupRejection: vi.fn(),
  reserveEveResponseGroup: mocks.reserve,
}));
vi.mock("./create-conversation-operation", () => ({
  createEveConversationOperation: mocks.create,
}));
vi.mock("./guest-admission", () => ({ settleGuestCreation: mocks.settle }));
const input = {
  message: "hello",
  modelIds: ["cheap", "cheap"],
  operationId: crypto.randomUUID(),
};
const group = {
  candidates: eveResponseGroupCandidates(input.operationId, input.modelIds),
  id: crypto.randomUUID(),
};

const admission = {
  group,
  reservations: group.candidates.map(
    ({ operationId }: Readonly<{ modelId: string; operationId: string }>) => ({
      operationId,
      reservationId: crypto.randomUUID(),
    })
  ),
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.create.mockResolvedValue(
    Response.json(
      { creationRejected: true, error: "Attachment unavailable" },
      { status: 400 }
    )
  );
  mocks.settle.mockResolvedValue(true);
  mocks.refund.mockResolvedValue(true);
});

it("refunds undispatched siblings after a proven primary rejection", async () => {
  const result = await createEveResponseGroup("guest", input, admission);
  expect(result.candidates.map((candidate) => candidate.state)).toEqual([
    "rejected",
    "waiting",
  ]);
  expect(mocks.create).toHaveBeenCalledTimes(1);
  expect(mocks.create.mock.calls[0][2]).toBe(
    admission.reservations[0].reservationId
  );
  expect(mocks.refund).toHaveBeenCalledExactlyOnceWith(
    "guest",
    group.candidates[1].operationId,
    admission.reservations[1].reservationId
  );
  expect(mocks.reserve).not.toHaveBeenCalled();
});

it("retains recovery if a sibling has concurrently claimed its creation", async () => {
  mocks.refund.mockResolvedValue(false);
  await expect(
    createEveResponseGroup("guest", input, admission)
  ).rejects.toThrow("Retain comparison recovery");
});
it("does not declare terminal rejection when the primary refund cannot prove non-admission", async () => {
  mocks.settle.mockResolvedValue(false);
  const result = await createEveResponseGroup("guest", input, admission);
  expect(result.candidates.map((candidate) => candidate.state)).toEqual([
    "unresolved",
    "waiting",
  ]);
  expect(mocks.refund).not.toHaveBeenCalled();
});
it("marks every multi-model edited candidate with the shared user intent", async () => {
  mocks.reserve.mockResolvedValue(group);
  await createEveResponseGroup("owner", {
    ...input,
    fork: { conversationId: crypto.randomUUID() },
    forkKind: "edit",
  });
  expect(mocks.create).toHaveBeenCalledTimes(2);

  expect(
    mocks.create.mock.calls.map(
      (call: Readonly<(typeof mocks.create.mock.calls)[number]>) =>
        call[1].forkKind
    )
  ).toEqual(["edit", "edit"]);
});

it("keeps shared-workspace backpressure waiting and retries only the saved ordered candidates", async () => {
  const shared = {
    ...input,
    modelIds: ["one", "two", "three"],
    fork: { conversationId: crypto.randomUUID() },
  };
  const reserved = {
    id: crypto.randomUUID(),
    candidates: eveResponseGroupCandidates(shared.operationId, shared.modelIds),
  };
  mocks.reserve.mockResolvedValue(reserved);
  const binding = { id: crypto.randomUUID(), sessionId: "native-first" };
  mocks.create.mockResolvedValueOnce(Response.json(binding));
  mocks.create.mockResolvedValueOnce(
    Response.json(
      { code: "workspace_busy", error: "Another turn is running" },
      { status: 409 }
    )
  );
  const first = await createEveResponseGroup("owner", shared);
  expect(first.candidates.map((candidate) => candidate.state)).toEqual([
    "bound",
    "waiting",
    "waiting",
  ]);
  expect(mocks.create).toHaveBeenCalledTimes(2);
  mocks.create.mockClear();
  mocks.create.mockImplementation(
    async (_owner, request) =>
      await Promise.resolve(
        Response.json({
          id: crypto.randomUUID(),
          sessionId: request.operationId,
        })
      )
  );
  const resumed = await createEveResponseGroup("owner", shared);
  expect(resumed.candidates.map((candidate) => candidate.state)).toEqual([
    "bound",
    "bound",
    "bound",
  ]);
  expect(mocks.create.mock.calls.map((call) => call[1].operationId)).toEqual(
    reserved.candidates.map((candidate) => candidate.operationId)
  );
});
