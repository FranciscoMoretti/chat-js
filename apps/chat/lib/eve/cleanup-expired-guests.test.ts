import { beforeEach, expect, test, vi } from "vitest";

import { cleanupExpiredEveGuests } from "./cleanup-expired-guests";

const mocks = vi.hoisted(() => ({
  available: vi.fn(),
  claim: vi.fn(),
  hasExpired: vi.fn(),
  copy: vi.fn(),
  deleteCopy: vi.fn(),
  remove: vi.fn(),
}));
vi.mock("./local-deletion-available", () => ({
  localDeletionAvailable: mocks.available,
}));
vi.mock("../db/eve-guest-cleanup", () => ({
  claimExpiredEveGuestFamilies: mocks.claim,
  hasExpiredEveGuestFamilies: mocks.hasExpired,
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
  mocks.hasExpired.mockResolvedValue(true);
  mocks.copy.mockResolvedValue(false);
  mocks.claim.mockResolvedValue([]);
});
test("unsupported providers do not claim or revoke expired families", async () => {
  mocks.available.mockReturnValue(false);
  expect(await cleanupExpiredEveGuests("/trusted/app")).toEqual({
    deletedCount: 0,
    reason: "unsupported_runtime",
    skipped: true,
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
    deletedCount: 1,
    pendingCount: 1,
    skipped: false,
  });
  expect(mocks.remove.mock.calls).toEqual([
    ["guest", "stuck", "/trusted/app"],
    ["guest", "ready", "/trusted/app"],
  ]);
});
test("never-dispatched copies use their proven unaccepted deletion path", async () => {
  mocks.claim.mockResolvedValueOnce([{ id: "copy", ownerId: "guest" }]);
  mocks.copy.mockResolvedValue(true);
  const resolvedResult1 = await cleanupExpiredEveGuests("/trusted/app");
  expect(resolvedResult1.deletedCount).toBe(1);
  expect(mocks.deleteCopy).toHaveBeenCalledWith("guest", "copy");
  expect(mocks.remove).not.toHaveBeenCalled();
});

test("an absent deletion receipt is pending and cannot count as an erased family", async () => {
  mocks.claim.mockResolvedValueOnce([{ id: "uncertain", ownerId: "guest" }]);
  expect(await cleanupExpiredEveGuests("/trusted/app")).toEqual({
    deletedCount: 0,
    pendingCount: 1,
    skipped: false,
  });
});
test("inventory failures reject instead of claiming an empty successful sweep", async () => {
  const failure = new Error("guest inventory unavailable");
  mocks.claim.mockRejectedValueOnce(failure);
  await expect(cleanupExpiredEveGuests("/trusted/app")).rejects.toBe(failure);
  expect(mocks.remove).not.toHaveBeenCalled();
});
test("a supported empty sweep reports success only after checking inventory", async () => {
  expect(await cleanupExpiredEveGuests("/trusted/app")).toEqual({
    deletedCount: 0,
    pendingCount: 0,
    skipped: false,
  });
  expect(mocks.claim).toHaveBeenCalledOnce();
});

test("unsupported runtime reports success only after a read-only empty inventory", async () => {
  mocks.available.mockReturnValue(false);
  mocks.hasExpired.mockResolvedValue(false);
  expect(await cleanupExpiredEveGuests("/trusted/app")).toEqual({
    deletedCount: 0,
    pendingCount: 0,
    skipped: false,
  });
  expect(mocks.hasExpired).toHaveBeenCalledOnce();
  expect(mocks.claim).not.toHaveBeenCalled();
  expect(mocks.remove).not.toHaveBeenCalled();
});

test("unsupported runtime inventory errors cannot masquerade as empty backlog", async () => {
  mocks.available.mockReturnValue(false);
  mocks.hasExpired.mockRejectedValue(new Error("inventory unavailable"));
  await expect(cleanupExpiredEveGuests("/trusted/app")).rejects.toThrow(
    "inventory unavailable"
  );
  expect(mocks.claim).not.toHaveBeenCalled();
});
