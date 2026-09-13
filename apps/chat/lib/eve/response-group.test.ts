import { beforeEach, expect, it, vi } from "vitest";

import { createEveResponseGroup } from "./response-group";
import { eveResponseGroupCandidates } from "./response-group-candidates";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  settle: vi.fn(),
  refund: vi.fn(),
  reserve: vi.fn(),
}));
vi.mock("../db/eve-guests", () => ({ releaseEveGuestCreation: mocks.refund }));
vi.mock("../db/eve-response-groups", () => ({
  reserveEveResponseGroup: mocks.reserve,
  recordEveResponseGroupRejection: vi.fn(),
}));
vi.mock("./create-conversation-operation", () => ({
  createEveConversationOperation: mocks.create,
}));
vi.mock("./guest-admission", () => ({ settleGuestCreation: mocks.settle }));
const input = {
  operationId: crypto.randomUUID(),
  modelIds: ["cheap", "cheap"],
  message: "hello",
};
const group = {
  id: crypto.randomUUID(),
  candidates: eveResponseGroupCandidates(input.operationId, input.modelIds),
};
const admission = {
  group,
  reservations: group.candidates.map(({ operationId }) => ({
    operationId,
    reservationId: crypto.randomUUID(),
  })),
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
