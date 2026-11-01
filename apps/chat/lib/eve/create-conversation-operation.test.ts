import type * as DispatchModule from "@/lib/db/eve-dispatch";
import { beforeEach, expect, it, vi } from "vitest";
import { z } from "zod";
import type { eveRequest } from "./server";
import type { createEveConversation } from "../db/eve-queries";

import { CreationConflictError } from "@/lib/db/creation-conflict-error";
import { CreationRejectedError } from "@/lib/creation-rejected-error";

import { createEveConversationOperation } from "./create-conversation-operation";
import { EveUsageReconciliationBusyError } from "./usage-reconciliation-busy";

const mocks = vi.hoisted(() => ({
  canSpend: vi.fn(),
  prepareMessage: vi.fn<() => Promise<string>>(),
  creation: vi.fn(),
  send: vi.fn<typeof DispatchModule.dispatchEveOnce>(),
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
vi.mock("@/lib/db/eve-dispatch", async (original) => ({
  ...(await original<typeof DispatchModule>()),
  dispatchEveOnce: mocks.send,
}));
vi.mock("@/lib/db/client", () => ({ db: {} }));
vi.mock("@/lib/env", () => ({ env: {} }));
vi.mock("@/lib/db/eve-queries", () => ({
  CreationConflictError,
  CreationRejectedError,
  createEveConversation: mocks.reserve,
  getEveConversation: mocks.source,
  getEveCreation: mocks.creation,
}));
vi.mock("@/integrations/billing", () => ({
  billing: { canSpend: mocks.canSpend, debit: undefined },
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
  fork: { conversationId: "source-chat" },
  message: "compare",
  modelId: "openai/gpt-4o",
  operationId: "ba1d7f02-597b-47a7-a8de-20f700500f0d",
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.canSpend.mockResolvedValue(true);
  mocks.prepareMessage.mockResolvedValue("prepared comparison");
  mocks.source.mockResolvedValue({ sessionId: "source", state: "bound" });
  mocks.reserve.mockImplementation(
    async (_owner, operationId, _title, dispatch) => ({
      sessionId: await dispatch(operationId),
    })
  );
  mocks.send.mockResolvedValue({ sessionId: "child", deliveryId: "delivery" });
  // oxlint-disable-next-line eslint/require-await -- Each transport mock call needs a fresh consumable response.
  mocks.request.mockImplementation(async (_owner, path) =>
    Response.json(
      path.endsWith("/child")
        ? { sessionId: "child", deliveryId: "delivery" }
        : { sessionId: "child" }
    )
  );
});

it("creates an idle seed then journals the first send separately", async () => {
  mocks.send.mockImplementation(async (_input, dispatch) => await dispatch());
  const response = await createEveConversationOperation("owner", input);
  expect(response.status).toBe(200);
  expect(mocks.reconcile.mock.invocationCallOrder[0]).toBeLessThan(
    mocks.canSpend.mock.invocationCallOrder[0]
  );
  expect(
    JSON.parse(z.string().parse(mocks.request.mock.calls[0]?.[2]?.body))
  ).toEqual({ operationId: input.operationId, seed: true });
  expect(
    JSON.parse(z.string().parse(mocks.request.mock.calls[1]?.[2]?.body))
  ).toEqual({ message: "prepared comparison" });
  expect(mocks.send.mock.calls[0]?.[0]).toMatchObject({
    kind: "send",
    operationId: input.operationId,
  });
});
it("maps project admission errors to not-found responses", async () => {
  mocks.reserve.mockRejectedValue(
    new CreationRejectedError("Project not found.", "project_not_found", 404)
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
  mocks.reserve.mockRejectedValue(
    new CreationConflictError("Creation is unresolved.")
  );
  const response = await createEveConversationOperation("owner", input);
  expect(response.status).toBe(409);
  expect(await response.json()).toMatchObject({
    code: "creation_conflict",
    error: "Creation is unresolved.",
  });
});
it("recovers an already allocated native operation without redispatching its create", async () => {
  mocks.creation.mockResolvedValue({ state: "bound" });
  mocks.reserve.mockResolvedValue({ sessionId: "existing-child" });
  const resolvedResult1 = await createEveConversationOperation("owner", input);
  expect(await resolvedResult1.json()).toEqual({ sessionId: "existing-child" });
  expect(mocks.request).not.toHaveBeenCalled();
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
    state: "bound",
  });
  mocks.reserve.mockResolvedValue({ sessionId: "accepted-child" });
  const response = await createEveConversationOperation("owner", input);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ sessionId: "accepted-child" });
  expect(mocks.source).not.toHaveBeenCalled();
  expect(mocks.request).not.toHaveBeenCalled();
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

vi.mock("./reconcile-workspace-turn", () => ({
  reconcileEveWorkspaceTurn: vi.fn(),
}));
