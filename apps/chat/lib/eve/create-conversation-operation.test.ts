// oxlint-disable-next-line eslint/max-classes-per-file -- Keep the related admission error variants alongside their shared query contract.
import { beforeEach, expect, it, vi } from "vitest";

import { createEveConversationOperation } from "./create-conversation-operation";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { EveUsageReconciliationBusyError } from "./usage-reconciliation-busy";
/* oxlint-enable sort-imports */

const mocks = vi.hoisted(() => ({
  creation: vi.fn(),
  readiness: vi.fn(),
  reconcile: vi.fn(),
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
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve vi.mock's required Promise and rejection contract. readEveGuestOwner mock resolves void to represent non-guest creation and retain the asynchronous mocked function contract. */
vi.mock("@/lib/db/eve-guests", () => ({
  readEveGuestOwner: async (): Promise<void> => {
    // This test exercises non-guest conversation creation.
  },
}));
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable typescript/promise-function-async --
 * typescript/promise-function-async (#606): vi.mock("@/lib/db/credits") preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
vi.mock("@/lib/db/credits", () => ({
  canSpend: (): Promise<boolean> => Promise.resolve(true),
}));
/* oxlint-enable typescript/promise-function-async */
vi.mock("@/lib/db/eve-files", () => ({ assertEveFilesOwned: vi.fn() }));
vi.mock("./model-selection", () => ({ loadEveModelDefinition: vi.fn() }));
/* oxlint-disable typescript/promise-function-async --
 * typescript/promise-function-async (#606): vi.mock("./prepare-message") preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
vi.mock("./prepare-message", () => ({
  prepareEveMessage: (message: string): Promise<string> =>
    Promise.resolve(message),
}));
/* oxlint-enable typescript/promise-function-async */
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
/* oxlint-disable max-params, typescript/promise-function-async, typescript/strict-boolean-expressions --
 * max-params (#511): beforeEach keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * typescript/promise-function-async (#606): beforeEach preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 * typescript/strict-boolean-expressions (#610): beforeEach intentionally keeps the existing falsy-value behavior of path.startsWith("/eve/chat/v1/operation/"); distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
beforeEach(() => {
  vi.resetAllMocks();
  mocks.source.mockResolvedValue({ sessionId: "source", state: "bound" });
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve mocks.reserve.mockImplementation's awaited sequencing and rejected-Promise behavior. */
  mocks.reserve.mockImplementation(
    async (_owner, operationId, _title, dispatch) => ({
      // oxlint-disable-next-line typescript/no-unsafe-assignment, typescript/no-unsafe-call -- #595: This create-conversation-operation fixture inspects controlled mock or JSON payloads; fully modeling the mock boundary requires a separate test-contract migration. #596: This create-conversation-operation fixture inspects controlled mock or JSON payloads; fully modeling the mock boundary requires a separate test-contract migration.
      sessionId: await dispatch(operationId),
    })
  );
  /* oxlint-enable oxc/no-async-await */
  mocks.request.mockImplementation((_owner, path) =>
    Promise.resolve(
      // oxlint-disable-next-line typescript/no-unsafe-call, typescript/no-unsafe-member-access -- #596: This create-conversation-operation fixture inspects controlled mock or JSON payloads; fully modeling the mock boundary requires a separate test-contract migration. #597: This create-conversation-operation fixture inspects controlled mock or JSON payloads; fully modeling the mock boundary requires a separate test-contract migration.
      path.startsWith("/eve/chat/v1/operation/")
        ? Response.json({ code: "eve_operation_not_found" }, { status: 404 })
        : Response.json({ sessionId: "child" })
    )
  );
});
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable max-params, typescript/promise-function-async, typescript/strict-boolean-expressions */
/* oxlint-disable no-magic-numbers, no-undefined, typescript/prefer-readonly-parameter-types --
 * no-magic-numbers (#517): it("does not allocate a native child before the initial checkpoint is ready") uses 409, 1, -1, 2 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * no-undefined (#519): it("does not allocate a native child before the initial checkpoint is ready") uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * typescript/prefer-readonly-parameter-types (#565): it("does not allocate a native child before the initial checkpoint is ready") accepts call; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 */
it("does not allocate a native child before the initial checkpoint is ready", async () => {
  mocks.readiness.mockRejectedValue(new Error("pending"));
  const response = await createEveConversationOperation("owner", input);
  expect(response.status).toBe(409);
  expect(await response.json()).not.toHaveProperty("creationRejected");
  // oxlint-disable-next-line typescript/no-unsafe-return -- #598: This create-conversation-operation fixture inspects controlled mock or JSON payloads; fully modeling the mock boundary requires a separate test-contract migration.
  expect(mocks.request.mock.calls.map((call) => call[1])).toEqual([
    `/eve/chat/v1/operation/${input.operationId}`,
  ]);
  mocks.readiness.mockResolvedValue(undefined);
  const retry = await createEveConversationOperation("owner", input);
  expect(await retry.json()).toEqual({ sessionId: "child" });
  // oxlint-disable-next-line typescript/no-unsafe-member-access -- #597: This create-conversation-operation fixture inspects controlled mock or JSON payloads; fully modeling the mock boundary requires a separate test-contract migration.
  expect(mocks.request.mock.calls.at(-1)?.[2].body).toContain(
    input.operationId
  );
  // oxlint-disable-next-line typescript/no-unsafe-member-access -- #597: This create-conversation-operation fixture inspects controlled mock or JSON payloads; fully modeling the mock boundary requires a separate test-contract migration.
  expect(mocks.request.mock.calls.at(-1)?.[2].body).toContain(
    '"beforeTurnId":"turn_0"'
  );
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-magic-numbers, no-undefined, typescript/prefer-readonly-parameter-types */
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable no-magic-numbers, no-undefined --
 * no-magic-numbers (#517): it("refuses a foreign or deleted source before reservation or checkpoint access") uses 404 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * no-undefined (#519): it("refuses a foreign or deleted source before reservation or checkpoint access") uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 */
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-magic-numbers, no-undefined */

/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): it("passes the same named checkpoint to readiness and native fork allocation") uses 200, -1, 2 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
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
  // oxlint-disable-next-line typescript/no-unsafe-assignment, typescript/no-unsafe-argument, typescript/no-unsafe-member-access -- #595: This create-conversation-operation fixture inspects controlled mock or JSON payloads; fully modeling the mock boundary requires a separate test-contract migration. #594: This create-conversation-operation fixture inspects controlled mock or JSON payloads; fully modeling the mock boundary requires a separate test-contract migration. #597: This create-conversation-operation fixture inspects controlled mock or JSON payloads; fully modeling the mock boundary requires a separate test-contract migration.
  const body = JSON.parse(mocks.request.mock.calls.at(-1)?.[2].body);
  // oxlint-disable-next-line typescript/no-unsafe-member-access -- #597: This create-conversation-operation fixture inspects controlled mock or JSON payloads; fully modeling the mock boundary requires a separate test-contract migration.
  expect(body.fork).toEqual({
    beforeTurnId: "turn_0",
    checkpointId,
    sessionId: "source",
  });
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-magic-numbers */

/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): it("persists fork intent without forwarding ChatJS metadata to Eve") uses 1, 200, -1, 4, 2 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
it("persists fork intent without forwarding ChatJS metadata to Eve", async () => {
  const regeneration = {
    ...input,
    forkKind: "regenerate",
  } satisfies Parameters<typeof createEveConversationOperation>[1];
  const response = await createEveConversationOperation("owner", regeneration);
  expect(response.status).toBe(200);
  // oxlint-disable-next-line typescript/no-unsafe-member-access -- #597: This create-conversation-operation fixture inspects controlled mock or JSON payloads; fully modeling the mock boundary requires a separate test-contract migration.
  expect(mocks.reserve.mock.calls.at(-1)?.[4].forkKind).toBe("regenerate");
  expect(
    // oxlint-disable-next-line typescript/no-unsafe-argument, typescript/no-unsafe-member-access -- #594: This create-conversation-operation fixture inspects controlled mock or JSON payloads; fully modeling the mock boundary requires a separate test-contract migration. #597: This create-conversation-operation fixture inspects controlled mock or JSON payloads; fully modeling the mock boundary requires a separate test-contract migration.
    JSON.parse(mocks.request.mock.calls.at(-1)?.[2].body)
  ).not.toHaveProperty("forkKind");
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-magic-numbers */

/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): it("rejects saved-copy operations before ordinary native lookup or dispatch") uses 409 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-magic-numbers */

/* oxlint-disable max-statements, no-magic-numbers --
 * max-statements (#512): it("dispatches imported forks by message identity without requiring an execution chec keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): it("dispatches imported forks by message identity without requiring an execution chec uses 200, -1, 2 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
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
  // oxlint-disable-next-line typescript/no-unsafe-member-access, typescript/no-unsafe-argument -- #597: This create-conversation-operation fixture inspects controlled mock or JSON payloads; fully modeling the mock boundary requires a separate test-contract migration. #594: This create-conversation-operation fixture inspects controlled mock or JSON payloads; fully modeling the mock boundary requires a separate test-contract migration.
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable max-statements, no-magic-numbers */

/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): it("forwards selected tools on creation and includes them in the reservation identity uses -1, 4 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
it("forwards selected tools on creation and includes them in the reservation identity", async () => {
  await createEveConversationOperation("owner", {
    ...input,
    selectedTool: "webSearch",
  });
  expect(mocks.request.mock.calls.at(-1)?.[4]).toBe("webSearch");
  // oxlint-disable-next-line typescript/no-unsafe-assignment, typescript/no-unsafe-member-access -- #595: This create-conversation-operation fixture inspects controlled mock or JSON payloads; fully modeling the mock boundary requires a separate test-contract migration. #597: This create-conversation-operation fixture inspects controlled mock or JSON payloads; fully modeling the mock boundary requires a separate test-contract migration.
  const originalHash = mocks.reserve.mock.calls.at(-1)?.[4].initialContentHash;
  expect(originalHash).toBeTypeOf("string");
  await createEveConversationOperation("owner", {
    ...input,
    selectedTool: "deepResearch",
  });
  // oxlint-disable-next-line typescript/no-unsafe-member-access -- #597: This create-conversation-operation fixture inspects controlled mock or JSON payloads; fully modeling the mock boundary requires a separate test-contract migration.
  expect(mocks.reserve.mock.calls.at(-1)?.[4].initialContentHash).not.toBe(
    originalHash
  );
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-magic-numbers */

/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): it("persists a compact fallback title before native creation") uses -1, 4 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
it("persists a compact fallback title before native creation", async () => {
  await createEveConversationOperation("owner", input);

  // oxlint-disable-next-line typescript/no-unsafe-member-access -- #597: This create-conversation-operation fixture inspects controlled mock or JSON payloads; fully modeling the mock boundary requires a separate test-contract migration.
  expect(mocks.reserve.mock.calls.at(-1)?.[4].initialTitle).toBe(
    "Fallback: compare"
  );
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-magic-numbers */

/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): it("journals the complete creation command before dispatch so another tab can recover uses 1, -1, 4 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
it("journals the complete creation command before dispatch so another tab can recover it", async () => {
  const command = { ...input, selectedTool: "webSearch" } satisfies Parameters<
    typeof createEveConversationOperation
  >[1];
  await createEveConversationOperation("owner", command);
  // oxlint-disable-next-line typescript/no-unsafe-member-access -- #597: This create-conversation-operation fixture inspects controlled mock or JSON payloads; fully modeling the mock boundary requires a separate test-contract migration.
  expect(mocks.reserve.mock.calls.at(-1)?.[4].initialRequest).toEqual(command);
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-magic-numbers */

/* oxlint-disable no-magic-numbers, no-undefined --
 * no-magic-numbers (#517): it("recovers an accepted fork after the source was deleted") uses 200, 1 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * no-undefined (#519): it("recovers an accepted fork after the source was deleted") uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 */
it("recovers an accepted fork after the source was deleted", async () => {
  mocks.creation.mockResolvedValue({
    creationKind: "message",
    state: "uncertain",
  });
  mocks.source.mockResolvedValue(undefined);
  mocks.request.mockResolvedValue(
    Response.json({ sessionId: "accepted-child" })
  );
  const response = await createEveConversationOperation("owner", input);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ sessionId: "accepted-child" });
  expect(mocks.source).not.toHaveBeenCalled();
  expect(mocks.request).toHaveBeenCalledTimes(1);
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-magic-numbers, no-undefined */

/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): it("preserves creation identity when billing recovery is busy") uses 503 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
it("preserves creation identity when billing recovery is busy", async () => {
  mocks.reconcile.mockRejectedValue(new EveUsageReconciliationBusyError());
  const response = await createEveConversationOperation("owner", input);
  expect(response.status).toBe(503);
  expect(response.headers.get("Retry-After")).toBe("2");
  // oxlint-disable-next-line typescript/no-unsafe-assignment -- #595: This create-conversation-operation fixture inspects controlled mock or JSON payloads; fully modeling the mock boundary requires a separate test-contract migration.
  const body = await response.json();
  expect(body).toMatchObject({
    code: "usage_reconciliation_busy",
    retryable: true,
  });
  expect(body).not.toHaveProperty("creationRejected");
  expect(mocks.reserve).not.toHaveBeenCalled();
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable no-magic-numbers */
