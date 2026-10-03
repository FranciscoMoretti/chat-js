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
/* oxlint-disable no-magic-numbers, typescript/explicit-function-return-type, typescript/promise-function-async --
 * no-magic-numbers (#517): resolve uses 1000 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * typescript/explicit-function-return-type (#560): Keep resolve's return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 * typescript/promise-function-async (#606): resolve preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
const resolve = (id: unknown = reservationId) =>
  resolveEveConversationScope("owner", "native", AbortSignal.timeout(1000), id);
/* oxlint-enable no-magic-numbers, typescript/explicit-function-return-type, typescript/promise-function-async */
/* oxlint-disable unicorn/no-null --
 * unicorn/no-null (#570): beforeEach preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
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
/* oxlint-enable unicorn/no-null */
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
/* oxlint-disable no-undefined, typescript/prefer-readonly-parameter-types, unicorn/no-null  --
 * no-undefined (#519): it.each([ [undefined, "identity_missing"], [{ ownerId: "foreign", state: "creating" } uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * oxc/no-async-await (#540): it.each([ [undefined, "identity_missing"], [{ ownerId: "foreign", state: "creating" } sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * typescript/prefer-readonly-parameter-types (#565): it.each([ [undefined, "identity_missing"], [{ ownerId: "foreign", state: "creating" } accepts row; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * unicorn/no-null (#570): it.each([ [undefined, "identity_missing"], [{ ownerId: "foreign", state: "creating" } preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
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
/* oxlint-enable no-undefined, typescript/prefer-readonly-parameter-types, unicorn/no-null */
/* oxlint-disable no-magic-numbers  --
 * no-magic-numbers (#517): it("uses the existing reverse binding for sessions created before the attribute exist uses 1000 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * oxc/no-async-await (#540): it("uses the existing reverse binding for sessions created before the attribute exist sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 */
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
/* oxlint-enable no-magic-numbers */
/* oxlint-disable no-magic-numbers, typescript/prefer-readonly-parameter-types  --
 * no-magic-numbers (#517): it.each([ [404, { code: "eve_operation_not_found" }, "receipt_pending"], [503, {}, "r uses 404, 503, 200 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * oxc/no-async-await (#540): it.each([ [404, { code: "eve_operation_not_found" }, "receipt_pending"], [503, {}, "r sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * typescript/prefer-readonly-parameter-types (#565): it.each([ [404, { code: "eve_operation_not_found" }, "receipt_pending"], [503, {}, "r accepts body; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 */
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
/* oxlint-enable no-magic-numbers, typescript/prefer-readonly-parameter-types */
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

/* oxlint-disable no-magic-numbers, no-undefined  --
 * no-magic-numbers (#517): it("does not call missing pre-attribute identity corruption") uses 1000 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * no-undefined (#519): it("does not call missing pre-attribute identity corruption") uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * oxc/no-async-await (#540): it("does not call missing pre-attribute identity corruption") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 */
it("does not call missing pre-attribute identity corruption", async () => {
  mocks.read.mockResolvedValue(undefined);
  await expect(
    resolveEveConversationScope("owner", "native", AbortSignal.timeout(1000))
  ).rejects.toMatchObject({ code: "identity_pending" });
});
/* oxlint-enable no-magic-numbers, no-undefined */

it("classifies a transport outage without treating the mapping as corrupt", async () => {
  mocks.request.mockRejectedValue(new TypeError("connection refused"));
  await expect(resolve()).rejects.toMatchObject({
    code: "receipt_unavailable",
  });
  expect(mocks.bind).not.toHaveBeenCalled();
});

/* oxlint-disable no-magic-numbers, no-undefined  --
 * no-magic-numbers (#517): it("rejects malformed context and missing authentication before reading storage") uses 1000 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * no-undefined (#519): it("rejects malformed context and missing authentication before reading storage") uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * oxc/no-async-await (#540): it("rejects malformed context and missing authentication before reading storage") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 */
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
/* oxlint-enable no-magic-numbers, no-undefined */
