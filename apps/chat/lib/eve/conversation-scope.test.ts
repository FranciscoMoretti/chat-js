import { beforeEach, expect, it, vi } from "vitest";

import { resolveEveConversationScope } from "./conversation-scope";

const mocks = vi.hoisted(() => ({
  bind: vi.fn(),
  read: vi.fn(),
}));
vi.mock("../db/eve-queries", () => ({
  bindAcceptedEveCreation: mocks.bind,
  readEveSessionMapping: mocks.read,
}));
const reservationId = "01912345-1234-7123-8123-123456789abc";
const resolve = async (id: unknown = reservationId, deliveryId = "delivery") =>
  await resolveEveConversationScope(
    "owner",
    "native",
    AbortSignal.timeout(1000),
    id,
    deliveryId
  );
beforeEach(() => {
  vi.resetAllMocks();
  mocks.read.mockResolvedValue({
    creationKind: "message",
    id: reservationId,
    ownerId: "owner",
    sessionId: null,
    state: "creating",
  });
});
it("binds the exact accepted session before the HTTP caller receives its reply", async () => {
  expect(await resolve()).toEqual({
    branchId: reservationId,
    ownerId: "owner",
  });
  expect(mocks.read).toHaveBeenCalledWith({ reservationId });
  expect(mocks.bind).toHaveBeenCalledWith(
    "owner",
    reservationId,
    "native",
    "delivery"
  );
});
it("waits for a trusted initial delivery when a reservation is still unbound", async () => {
  await expect(resolve(reservationId, "")).rejects.toMatchObject({
    code: "identity_pending",
  });
  expect(mocks.bind).not.toHaveBeenCalled();
});
it.each([
  [null, "identity_missing"],
  [{ ownerId: "foreign", state: "creating" }, "owner_mismatch"],
  [{ ownerId: "owner", state: "deleted" }, "identity_deleted"],
  [{ ownerId: "owner", state: "deleting" }, "identity_deleted"],
  [
    { ownerId: "owner", sessionId: "other", state: "bound" },
    "binding_conflict",
  ],
  [{ ownerId: "owner", sessionId: null, state: "bound" }, "binding_conflict"],
])(
  "rejects inconsistent or retired mapping %j",
  async (
    row: Readonly<
      | { ownerId: string; state: string }
      | { ownerId: string; sessionId: string; state: string }
      | { ownerId: string; sessionId: null; state: string }
      | null
    >,
    code
  ) => {
    mocks.read.mockResolvedValue(row);
    await expect(resolve()).rejects.toMatchObject({ code });
    expect(mocks.bind).not.toHaveBeenCalled();
  }
);
it("uses the existing reverse binding for sessions created before the attribute existed", async () => {
  mocks.read.mockResolvedValue({
    id: reservationId,
    ownerId: "owner",
    sessionId: "native",
    state: "bound",
  });
  expect(
    await resolveEveConversationScope(
      "owner",
      "native",
      AbortSignal.timeout(1000)
    )
  ).toEqual({ branchId: reservationId, ownerId: "owner" });
});
it("leaves pending copies to their resource journal", async () => {
  mocks.read.mockResolvedValue({
    creationKind: "copy",
    id: reservationId,
    ownerId: "owner",
    state: "creating",
  });
  await expect(resolve()).rejects.toMatchObject({ code: "identity_pending" });
  expect(mocks.bind).not.toHaveBeenCalled();
});
it("does not call missing pre-attribute identity corruption", async () => {
  mocks.read.mockResolvedValue(null);
  await expect(
    resolveEveConversationScope("owner", "native", AbortSignal.timeout(1000))
  ).rejects.toMatchObject({ code: "identity_pending" });
});

it("rejects malformed context and missing authentication before reading storage", async () => {
  await expect(resolve("not-a-reservation")).rejects.toMatchObject({
    code: "binding_conflict",
  });
  await expect(
    resolveEveConversationScope(
      undefined,
      "native",
      AbortSignal.timeout(1000),
      reservationId
    )
  ).rejects.toMatchObject({ code: "unauthenticated" });
  expect(mocks.read).not.toHaveBeenCalled();
});
