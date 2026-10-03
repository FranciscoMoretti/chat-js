import { beforeEach, expect, test, vi } from "vitest";

import { cleanupExpiredEveGuests } from "./cleanup-expired-guests";

const mocks = vi.hoisted(() => ({
  available: vi.fn(),
  claim: vi.fn(),
  copy: vi.fn(),
  deleteCopy: vi.fn(),
  remove: vi.fn(),
}));
vi.mock("./local-deletion-available", () => ({
  localDeletionAvailable: mocks.available,
}));
vi.mock("../db/eve-guest-cleanup", () => ({
  claimExpiredEveGuestFamilies: mocks.claim,
}));
vi.mock("../db/eve-copy-journal", () => ({ isUnacceptedEveCopy: mocks.copy }));
vi.mock("./delete-unaccepted-copy", () => ({
  deleteUnacceptedEveCopy: mocks.deleteCopy,
}));
vi.mock("./delete-local-conversation", () => ({
  deleteLocalEveConversationFamily: mocks.remove,
}));
beforeEach(() => {
  vi.resetAllMocks();
  mocks.available.mockReturnValue(true);
  mocks.copy.mockResolvedValue(false);
  mocks.claim.mockResolvedValue([]);
});
/* oxlint-disable oxc/no-async-await --
 * oxc/no-async-await (#540): test("unsupported providers do not claim or revoke expired families") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 */
test("unsupported providers do not claim or revoke expired families", async () => {
  mocks.available.mockReturnValue(false);
  expect(await cleanupExpiredEveGuests("/trusted/app")).toEqual({
    deletedCount: 0,
    pendingCount: 0,
    skipped: true,
  });
  expect(mocks.claim).not.toHaveBeenCalled();
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await --
 * oxc/no-async-await (#540): test("failed deletion remains pending while the rest of the batch progresses") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 */
test("failed deletion remains pending while the rest of the batch progresses", async () => {
  mocks.claim
    .mockResolvedValueOnce([{ id: "stuck", ownerId: "guest" }])
    .mockResolvedValueOnce([{ id: "ready", ownerId: "guest" }]);
  mocks.remove
    .mockRejectedValueOnce(new Error("uncertain native creation"))
    .mockResolvedValueOnce({ rootId: "ready" });
  expect(await cleanupExpiredEveGuests("/trusted/app")).toEqual({
    deletedCount: 1,
    pendingCount: 1,
    skipped: false,
  });
  expect(mocks.remove.mock.calls).toEqual([
    ["guest", "stuck", "/trusted/app"],
    ["guest", "ready", "/trusted/app"],
  ]);
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable no-magic-numbers, oxc/no-async-await --
 * no-magic-numbers (#517): test("never-dispatched copies use their proven unaccepted deletion path") uses 1 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * oxc/no-async-await (#540): test("never-dispatched copies use their proven unaccepted deletion path") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 */
test("never-dispatched copies use their proven unaccepted deletion path", async () => {
  mocks.claim.mockResolvedValueOnce([{ id: "copy", ownerId: "guest" }]);
  mocks.copy.mockResolvedValue(true);
  const resolvedResult1 = await cleanupExpiredEveGuests("/trusted/app");
  expect(resolvedResult1.deletedCount).toBe(1);
  expect(mocks.deleteCopy).toHaveBeenCalledWith("guest", "copy");
  expect(mocks.remove).not.toHaveBeenCalled();
});
/* oxlint-enable no-magic-numbers, oxc/no-async-await */
