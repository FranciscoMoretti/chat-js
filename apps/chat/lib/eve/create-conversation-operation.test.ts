import { beforeEach, expect, it, vi } from "vitest";
import { z } from "zod";
import type { readEveGuestOwner } from "../db/eve-guests";
import type { eveRequest } from "./server";
import type { createEveConversation } from "../db/eve-queries";

import { CreationConflictError } from "@/lib/db/creation-conflict-error";
import { CreationProjectNotFoundError } from "@/lib/db/creation-project-not-found-error";

import { createEveConversationOperation } from "./create-conversation-operation";
import { EveUsageReconciliationBusyError } from "./usage-reconciliation-busy";

const mocks = vi.hoisted(() => ({
  canSpend: vi.fn(),
  prepareMessage: vi.fn<() => Promise<string>>(),
  creation: vi.fn(),
  guest: vi.fn<typeof readEveGuestOwner>(),
  readiness: vi.fn<() => Promise<void>>(),
  reconcile: vi.fn(),
  request: vi.fn<typeof eveRequest>(),
  reserve:
    vi.fn<
      (
        ...args: Parameters<typeof createEveConversation>
      ) => Promise<{ sessionId: string }>
    >(),
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
  CreationConflictError,
  CreationProjectNotFoundError,
  createEveConversation: mocks.reserve,
  getEveConversation: mocks.source,
  getEveCreation: mocks.creation,
}));
vi.mock("@/lib/db/eve-guests", () => ({
  readEveGuestOwner: mocks.guest,
}));
vi.mock("@/lib/db/credits", () => ({
  canSpend: mocks.canSpend,
}));
vi.mock("@/lib/db/eve-files", () => ({ assertEveFilesOwned: vi.fn() }));
vi.mock("./model-selection", () => ({ loadEveModelDefinition: vi.fn() }));
vi.mock("./prepare-message", () => ({
  prepareEveMessage: mocks.prepareMessage,
}));
vi.mock("./reconcile-usage", () => ({
  reconcileEveOwnerUsage: mocks.reconcile,
}));

vi.mock("./conversation-title", () => ({
  eveConversationTitleFallback: (message: string): string =>
    `Fallback: ${message}`,
}));

const input = {
  fork: { beforeTurnId: "turn_0", conversationId: "source-chat" },
  message: "compare",
  modelId: "openai/gpt-4o",
  operationId: "ba1d7f02-597b-47a7-a8de-20f700500f0d",
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.canSpend.mockResolvedValue(true);
  mocks.prepareMessage.mockResolvedValue("prepared comparison");
  mocks.guest.mockResolvedValue(null);
  mocks.source.mockResolvedValue({ sessionId: "source", state: "bound" });
  mocks.reserve.mockImplementation(
    async (_owner, operationId, _title, dispatch) => ({
      sessionId: await dispatch(operationId),
    })
  );
  // oxlint-disable-next-line typescript/promise-function-async -- The Promise-only request fixture returns fresh consumable bodies for lookup and dispatch routes; a static Response loses routing or body freshness, and eslint/require-await rejects an immediate async factory.
  mocks.request.mockImplementation((_owner, path) =>
    Promise.resolve(
      path.startsWith("/eve/chat/v1/operation/")
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

  expect(
    mocks.request.mock.calls.map(
      (call: Readonly<(typeof mocks.request.mock.calls)[number]>) => call[1]
    )
  ).toEqual([`/eve/chat/v1/operation/${input.operationId}`]);
  mocks.readiness.mockResolvedValue();
  const retry = await createEveConversationOperation("owner", input);
  expect(await retry.json()).toEqual({ sessionId: "child" });
  expect(mocks.prepareMessage).toHaveBeenLastCalledWith(
    input.message,
    input.modelId
  );
  expect(
    JSON.parse(z.string().parse(mocks.request.mock.calls.at(-1)?.[2]?.body))
  ).toMatchObject({
    message: "prepared comparison",
  });
  expect(mocks.request.mock.calls.at(-1)?.[2]?.body).toContain(
    input.operationId
  );
  expect(mocks.request.mock.calls.at(-1)?.[2]?.body).toContain(
    '"beforeTurnId":"turn_0"'
  );
});
it("maps project admission errors to not-found responses", async () => {
  mocks.readiness.mockRejectedValue(
    new CreationProjectNotFoundError("Project not found.")
  );
  const response = await createEveConversationOperation("owner", input);
  expect(response.status).toBe(404);
  expect(await response.json()).toEqual({
    code: "project_not_found",
    creationRejected: true,
    error: "Project not found.",
  });
});
it("preserves conflict error identity and response codes", async () => {
  mocks.readiness.mockRejectedValue(
    new CreationConflictError("Creation is unresolved.")
  );
  const response = await createEveConversationOperation("owner", input);
  expect(response.status).toBe(409);
  expect(await response.json()).toMatchObject({
    code: "creation_conflict",
    error: "Creation is unresolved.",
  });
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
  mocks.source.mockResolvedValue(null);
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
  const body = z
    .object({ fork: z.unknown() })
    .parse(
      JSON.parse(z.string().parse(mocks.request.mock.calls.at(-1)?.[2]?.body))
    );
  expect(body.fork).toEqual({
    beforeTurnId: "turn_0",
    checkpointId,
    sessionId: "source",
  });
});

it("persists fork intent without forwarding ChatJS metadata to Eve", async () => {
  const regeneration = {
    ...input,
    forkKind: "regenerate",
  } satisfies Parameters<typeof createEveConversationOperation>[1];
  const response = await createEveConversationOperation("owner", regeneration);
  expect(response.status).toBe(200);
  expect(mocks.reserve.mock.calls.at(-1)?.[4]?.forkKind).toBe("regenerate");
  expect(
    JSON.parse(z.string().parse(mocks.request.mock.calls.at(-1)?.[2]?.body))
  ).not.toHaveProperty("forkKind");
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
  expect(
    z
      .object({ fork: z.unknown() })
      .parse(
        JSON.parse(z.string().parse(mocks.request.mock.calls.at(-1)?.[2]?.body))
      ).fork
  ).toEqual({
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
  const originalHash = mocks.reserve.mock.calls.at(-1)?.[4]?.initialContentHash;
  expect(originalHash).toBeTypeOf("string");
  await createEveConversationOperation("owner", {
    ...input,
    selectedTool: "deepResearch",
  });
  expect(mocks.reserve.mock.calls.at(-1)?.[4]?.initialContentHash).not.toBe(
    originalHash
  );
});

it("persists a compact fallback title before native creation", async () => {
  await createEveConversationOperation("owner", input);

  expect(mocks.reserve.mock.calls.at(-1)?.[4]?.initialTitle).toBe(
    "Fallback: compare"
  );
});

it("journals the complete creation command before dispatch so another tab can recover it", async () => {
  const command = { ...input, selectedTool: "webSearch" } satisfies Parameters<
    typeof createEveConversationOperation
  >[1];
  await createEveConversationOperation("owner", command);
  expect(mocks.reserve.mock.calls.at(-1)?.[4]?.initialRequest).toEqual(command);
});

it("recovers an accepted fork after the source was deleted", async () => {
  mocks.creation.mockResolvedValue({
    creationKind: "message",
    state: "uncertain",
  });
  mocks.request.mockResolvedValue(
    Response.json({ sessionId: "accepted-child" })
  );
  const response = await createEveConversationOperation("owner", input);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ sessionId: "accepted-child" });
  expect(mocks.source).not.toHaveBeenCalled();
  expect(mocks.request).toHaveBeenCalledTimes(1);
});

it("preserves creation identity when billing recovery is busy", async () => {
  mocks.reconcile.mockRejectedValue(new EveUsageReconciliationBusyError());
  const response = await createEveConversationOperation("owner", input);
  expect(response.status).toBe(503);
  expect(response.headers.get("Retry-After")).toBe("2");
  const body: unknown = await response.json();
  expect(body).toMatchObject({
    code: "usage_reconciliation_busy",
    retryable: true,
  });
  expect(body).not.toHaveProperty("creationRejected");
  expect(mocks.reserve).not.toHaveBeenCalled();
});
