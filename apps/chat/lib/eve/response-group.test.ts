import { beforeEach, expect, it, vi } from "vitest";

import { createEveResponseGroup } from "./response-group";
import { eveResponseGroupCandidates } from "./response-group-candidates";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
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
/* oxlint-disable typescript/prefer-readonly-parameter-types --
 * typescript/prefer-readonly-parameter-types (#565): admission accepts { operationId }; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 */
const admission = {
  group,
  reservations: group.candidates.map(({ operationId }) => ({
    operationId,
    reservationId: crypto.randomUUID(),
  })),
};
/* oxlint-enable typescript/prefer-readonly-parameter-types */

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

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): it("refunds undispatched siblings after a proven primary rejection") uses 1, 0, 2 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-magic-numbers */

it("retains recovery if a sibling has concurrently claimed its creation", async () => {
  mocks.refund.mockResolvedValue(false);
  await expect(
    createEveResponseGroup("guest", input, admission)
  ).rejects.toThrow("Retain comparison recovery");
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
it("does not declare terminal rejection when the primary refund cannot prove non-admission", async () => {
  mocks.settle.mockResolvedValue(false);
  const result = await createEveResponseGroup("guest", input, admission);
  expect(result.candidates.map((candidate) => candidate.state)).toEqual([
    "unresolved",
    "waiting",
  ]);
  expect(mocks.refund).not.toHaveBeenCalled();
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable no-magic-numbers, typescript/prefer-readonly-parameter-types --
 * no-magic-numbers (#517): it("marks every multi-model edited candidate with the shared user intent") uses 2, 1 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * typescript/prefer-readonly-parameter-types (#565): it("marks every multi-model edited candidate with the shared user intent") accepts call; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 */
it("marks every multi-model edited candidate with the shared user intent", async () => {
  mocks.reserve.mockResolvedValue(group);
  await createEveResponseGroup("owner", {
    ...input,
    fork: { beforeTurnId: "turn_0", conversationId: crypto.randomUUID() },
    forkKind: "edit",
  });
  expect(mocks.create).toHaveBeenCalledTimes(2);
  // oxlint-disable-next-line typescript/no-unsafe-return, typescript/no-unsafe-member-access -- #598: This response-group fixture inspects controlled mock or JSON payloads; fully modeling the mock boundary requires a separate test-contract migration. #597: This response-group fixture inspects controlled mock or JSON payloads; fully modeling the mock boundary requires a separate test-contract migration.
  expect(mocks.create.mock.calls.map((call) => call[1].forkKind)).toEqual([
    "edit",
    "edit",
  ]);
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable no-magic-numbers, typescript/prefer-readonly-parameter-types */
