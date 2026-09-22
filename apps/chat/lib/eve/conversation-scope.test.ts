import { beforeEach, expect, it, vi } from "vitest";

import { resolveEveConversationScope } from "./conversation-scope";

const mocks = vi.hoisted(() => ({
  bind: vi.fn(),
  read: vi.fn(),
  request: vi.fn(),
}));
vi.mock("../db/eve-queries", () => ({
  bindAcceptedEveConversation: mocks.bind,
  readEveSessionMapping: mocks.read,
}));
vi.mock("./server", () => ({ eveRequest: mocks.request }));
const reservationId = "01912345-1234-7123-8123-123456789abc";
const resolve = (id: unknown = reservationId) =>
  resolveEveConversationScope("owner", "native", AbortSignal.timeout(1000), id);
beforeEach(() => {
  vi.resetAllMocks();
  mocks.read.mockResolvedValue({
    creationKind: "message",
    id: reservationId,
    ownerId: "owner",
    sessionId: null,
    state: "creating",
  });
  mocks.request.mockResolvedValue(Response.json({ sessionId: "native" }));
});
it("binds the exact accepted session before the HTTP caller receives its reply", async () => {
  expect(await resolve()).toEqual({
    conversationId: reservationId,
    ownerId: "owner",
  });
  expect(mocks.read).toHaveBeenCalledWith({ reservationId });
  expect(mocks.bind).toHaveBeenCalledWith("owner", reservationId, "native");
});
it("rejects a subagent inheriting its parent's reservation attribute", async () => {
  mocks.request.mockResolvedValue(Response.json({ sessionId: "parent" }));
  await expect(resolve()).rejects.toMatchObject({ code: "binding_conflict" });
  expect(mocks.bind).not.toHaveBeenCalled();
});
it.each([
  [undefined, "identity_missing"],
  [{ ownerId: "foreign", state: "creating" }, "owner_mismatch"],
  [{ ownerId: "owner", state: "deleted" }, "identity_deleted"],
  [{ ownerId: "owner", state: "deleting" }, "identity_deleted"],
  [
    { ownerId: "owner", sessionId: "other", state: "bound" },
    "binding_conflict",
  ],
  [{ ownerId: "owner", sessionId: null, state: "bound" }, "binding_conflict"],
])("rejects inconsistent or retired mapping %j", async (row, code) => {
  mocks.read.mockResolvedValue(row);
  await expect(resolve()).rejects.toMatchObject({ code });
  expect(mocks.request).not.toHaveBeenCalled();
  expect(mocks.bind).not.toHaveBeenCalled();
});
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
  ).toEqual({ conversationId: reservationId, ownerId: "owner" });
  expect(mocks.request).not.toHaveBeenCalled();
});
it.each([
  [404, { code: "eve_operation_not_found" }, "receipt_pending"],
  [503, {}, "receipt_unavailable"],
  [200, {}, "receipt_unavailable"],
])(
  "keeps receipt availability separate from corruption (%s)",
  async (status, body, code) => {
    mocks.request.mockResolvedValue(Response.json(body, { status }));
    await expect(resolve()).rejects.toMatchObject({ code });
    expect(mocks.bind).not.toHaveBeenCalled();
  }
);
it("leaves pending copies to their resource journal", async () => {
  mocks.read.mockResolvedValue({
    creationKind: "copy",
    id: reservationId,
    ownerId: "owner",
    state: "creating",
  });
  await expect(resolve()).rejects.toMatchObject({ code: "identity_pending" });
  expect(mocks.bind).not.toHaveBeenCalled();
  expect(mocks.request).not.toHaveBeenCalled();
});

it("does not call missing pre-attribute identity corruption", async () => {
  mocks.read.mockResolvedValue(undefined);
  await expect(
    resolveEveConversationScope("owner", "native", AbortSignal.timeout(1000))
  ).rejects.toMatchObject({ code: "identity_pending" });
});

it("classifies a transport outage without treating the mapping as corrupt", async () => {
  mocks.request.mockRejectedValue(new TypeError("connection refused"));
  await expect(resolve()).rejects.toMatchObject({
    code: "receipt_unavailable",
  });
  expect(mocks.bind).not.toHaveBeenCalled();
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
