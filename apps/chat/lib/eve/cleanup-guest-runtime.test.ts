import { beforeEach, expect, test, vi } from "vitest";

const calls = vi.hoisted(() => ({
  claim: vi.fn(),
  complete: vi.fn(),
  bind: vi.fn(),
  prune: vi.fn(),
  pending: vi.fn(),
  check: vi.fn(),
  purge: vi.fn(),
  reset: vi.fn(),
  snapshot: vi.fn(),
}));
vi.mock("@/lib/db/guest-runtime", () => ({
  claimExpiredGuestRuntimeSession: calls.claim,
  completeGuestRuntimeDeletion: calls.complete,
  bindGuestRuntimeCleanupSession: calls.bind,
  pruneGuestRuntimeRates: calls.prune,
  countPendingGuestRuntimeDeletions: calls.pending,
}));
vi.mock("./deletion-lifecycle", () => ({
  requireEveDeletionLifecycle: () => ({
    check: calls.check,
    purge: calls.purge,
  }),
}));
vi.mock("./guest-cleanup-auth", () => ({
  getGuestCleanupConnectionOptions: () => ({
    host: "http://localhost/eve/chat",
    auth: { bearer: "cleanup-only" },
    headers: {},
  }),
}));
vi.mock("eve/client", () => ({
  Client: class {
    sessions = {
      attach: () => ({ reset: calls.reset, snapshot: calls.snapshot }),
    };
  },
}));
const { cleanupGuestRuntimeSessions } = await import("./cleanup-guest-runtime");
const guest = { id: "policy", ownerId: "owner", sessionId: "guest-session" };

beforeEach(() => {
  vi.resetAllMocks();
  vi.unstubAllGlobals();
  calls.claim.mockResolvedValue(null);
  calls.pending.mockResolvedValueOnce(1).mockResolvedValue(0);
  calls.complete.mockResolvedValue(true);
  calls.bind.mockResolvedValue(true);
  calls.snapshot.mockResolvedValue({ events: [{ type: "session.completed" }] });
  calls.purge.mockImplementation(
    async (_sessionId: string, retire: () => Promise<void>) => {
      await retire();
    }
  );
});

test("purges only claimed session and completes policy after native retirement", async () => {
  calls.claim.mockResolvedValueOnce(guest);
  expect(await cleanupGuestRuntimeSessions()).toEqual({
    deletedCount: 1,
    pendingCount: 0,
    skipped: false,
  });
  expect(calls.purge).toHaveBeenCalledWith(
    "guest-session",
    expect.any(Function)
  );
  expect(calls.complete).toHaveBeenCalledWith("policy", "guest-session");
  expect(calls.reset).toHaveBeenCalledOnce();
});

test("failed retirement remains pending without declaring deletion", async () => {
  calls.claim.mockResolvedValueOnce(guest);
  calls.snapshot.mockResolvedValue({ events: [] });
  const result = await cleanupGuestRuntimeSessions();
  expect(result.pendingCount).toBe(1);
  expect(calls.complete).not.toHaveBeenCalled();
});

test("missing provider fences fail before claims and deletion", async () => {
  calls.check.mockRejectedValue(new Error("missing fences"));
  await expect(cleanupGuestRuntimeSessions()).rejects.toThrow("missing fences");
  expect(calls.claim).not.toHaveBeenCalled();
  expect(calls.purge).not.toHaveBeenCalled();
});

test("bounds cleanup to five attempts even with an endless backlog", async () => {
  calls.claim.mockResolvedValue(guest);
  const result = await cleanupGuestRuntimeSessions();
  expect(result.deletedCount).toBe(5);
  expect(calls.claim).toHaveBeenCalledTimes(5);
});

test("replays interrupted creation with original operation identity before purge", async () => {
  calls.claim.mockResolvedValueOnce({ ...guest, sessionId: null });
  const fetch = vi
    .fn()
    .mockResolvedValue(Response.json({ sessionId: "recovered" }));
  vi.stubGlobal("fetch", fetch);
  const result = await cleanupGuestRuntimeSessions();
  expect(result.deletedCount).toBe(1);
  expect(fetch).toHaveBeenCalledWith(
    "http://localhost/eve/chat/v1/session",
    expect.objectContaining({ body: JSON.stringify({ operationId: "policy" }) })
  );
  expect(calls.bind).toHaveBeenCalledWith("policy", "owner", "recovered");
  expect(calls.complete).toHaveBeenCalledWith("policy", "recovered");
});

test("cooldown-hidden deletion work remains pending even when no claim is available", async () => {
  calls.pending.mockReset().mockResolvedValue(2);
  expect(await cleanupGuestRuntimeSessions()).toEqual({
    deletedCount: 0,
    pendingCount: 2,
    skipped: false,
  });
});

test("empty expired inventory needs no provider mutation support", async () => {
  calls.pending.mockReset().mockResolvedValue(0);
  calls.check.mockRejectedValue(new Error("unsupported world"));
  expect(await cleanupGuestRuntimeSessions()).toEqual({
    deletedCount: 0,
    pendingCount: 0,
    skipped: false,
  });
  expect(calls.check).not.toHaveBeenCalled();
  expect(calls.claim).not.toHaveBeenCalled();
});

test("unclaimed expired backlog remains visible after the batch limit", async () => {
  calls.pending.mockReset().mockResolvedValueOnce(8).mockResolvedValue(3);
  calls.claim.mockResolvedValue(guest);
  expect(await cleanupGuestRuntimeSessions()).toEqual({
    deletedCount: 5,
    pendingCount: 3,
    skipped: false,
  });
});
