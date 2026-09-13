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
test("unsupported providers do not claim or revoke expired families", async () => {
  mocks.available.mockReturnValue(false);
  expect(await cleanupExpiredEveGuests("/trusted/app")).toEqual({
    skipped: true,
    deletedCount: 0,
    pendingCount: 0,
  });
  expect(mocks.claim).not.toHaveBeenCalled();
});
test("failed deletion remains pending while the rest of the batch progresses", async () => {
  mocks.claim
    .mockResolvedValueOnce([{ id: "stuck", ownerId: "guest" }])
    .mockResolvedValueOnce([{ id: "ready", ownerId: "guest" }]);
  mocks.remove
    .mockRejectedValueOnce(new Error("uncertain native creation"))
    .mockResolvedValueOnce({ rootId: "ready" });
  expect(await cleanupExpiredEveGuests("/trusted/app")).toEqual({
    skipped: false,
    deletedCount: 1,
    pendingCount: 1,
  });
  expect(mocks.remove.mock.calls).toEqual([
    ["guest", "stuck", "/trusted/app"],
    ["guest", "ready", "/trusted/app"],
  ]);
});
test("never-dispatched copies use their proven unaccepted deletion path", async () => {
  mocks.claim.mockResolvedValueOnce([{ id: "copy", ownerId: "guest" }]);
  mocks.copy.mockResolvedValue(true);
  expect((await cleanupExpiredEveGuests("/trusted/app")).deletedCount).toBe(1);
  expect(mocks.deleteCopy).toHaveBeenCalledWith("guest", "copy");
  expect(mocks.remove).not.toHaveBeenCalled();
});
