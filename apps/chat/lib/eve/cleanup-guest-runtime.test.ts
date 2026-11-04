import { beforeEach, expect, test, vi } from "vitest";
import { ClientError } from "eve/client";
import type * as EveClient from "eve/client";

const calls = vi.hoisted(() => ({
  claim: vi.fn(),
  complete: vi.fn(),
  bind: vi.fn(),
  prune: vi.fn(),
  pending: vi.fn(),
  world: vi.fn(),
  check: vi.fn(),
  purge: vi.fn(),
  end: vi.fn(),
  snapshot: vi.fn(),
}));
vi.mock("@/chatjs/plugins/guest-chat/guest-queries", () => ({
  claimExpiredGuestRuntimeSession: calls.claim,
  completeGuestRuntimeDeletion: calls.complete,
  bindGuestRuntimeCleanupSession: calls.bind,
  pruneGuestRuntimeRates: calls.prune,
  countPendingGuestRuntimeDeletions: calls.pending,
}));
vi.mock("@/lib/env", () => ({ env: {} }));
vi.mock("./world-config", () => ({ resolveWorkflowWorld: calls.world }));
vi.mock("./deletion-lifecycle", () => ({
  requireEveDeletionLifecycle: () => ({
    check: calls.check,
    purge: calls.purge,
  }),
}));
vi.mock("@/chatjs/plugins/guest-chat/guest-cleanup-auth", () => ({
  getGuestCleanupConnectionOptions: () => ({
    baseUrl: "http://localhost/eve/chat",
    auth: { bearer: "cleanup-only" },
    headers: {},
  }),
}));
vi.mock("eve/client", async (importOriginal) => ({
  ...(await importOriginal<typeof EveClient>()),
  Client: class {
    sessions = {
      attach: () => ({ end: calls.end, snapshot: calls.snapshot }),
    };
  },
}));
const { cleanupGuestRuntimeSessions } =
  await import("@/chatjs/plugins/guest-chat/guest-cleanup");
const guest = { id: "policy", ownerId: "owner", sessionId: "guest-session" };

beforeEach(() => {
  vi.resetAllMocks();
  calls.world.mockReturnValue("@workflow/world-postgres");
  vi.unstubAllGlobals();
  calls.claim.mockResolvedValue(null);
  calls.pending.mockResolvedValueOnce(1).mockResolvedValue(0);
  calls.complete.mockResolvedValue(true);
  calls.bind.mockResolvedValue(true);
  calls.snapshot
    .mockResolvedValueOnce({ events: [] })
    .mockResolvedValue({ events: [{ type: "session.ended" }] });
  calls.end.mockResolvedValue({
    async *stream() {
      yield { type: "session.ended" };
    },
  });
  calls.purge.mockImplementation(
    async (_sessionId: string, retire: () => Promise<void>) => {
      await retire();
    }
  );
});

test("purges only claimed session and completes policy after native retirement", async () => {
  calls.claim.mockResolvedValueOnce(guest);
  expect(await cleanupGuestRuntimeSessions()).toEqual({
    retiredCount: 0,
    deletedCount: 1,
    pendingCount: 0,
    skipped: false,
  });
  expect(calls.purge).toHaveBeenCalledWith(
    "guest-session",
    expect.any(Function)
  );
  expect(calls.complete).toHaveBeenCalledWith("policy", "guest-session");
  expect(calls.end).toHaveBeenCalledOnce();
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
    retiredCount: 0,
    deletedCount: 0,
    pendingCount: 2,
    skipped: false,
  });
});

test("empty expired inventory needs no provider mutation support", async () => {
  calls.pending.mockReset().mockResolvedValue(0);
  calls.check.mockRejectedValue(new Error("unsupported world"));
  expect(await cleanupGuestRuntimeSessions()).toEqual({
    retiredCount: 0,
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
    retiredCount: 0,
    deletedCount: 5,
    pendingCount: 3,
    skipped: false,
  });
});

test("managed cleanup ends the session but never reports payload erasure", async () => {
  calls.world.mockReturnValue("vercel");
  calls.claim.mockResolvedValueOnce(guest);
  expect(await cleanupGuestRuntimeSessions()).toEqual({
    deletedCount: 0,
    retiredCount: 1,
    pendingCount: 0,
    skipped: false,
  });
  expect(calls.check).not.toHaveBeenCalled();
  expect(calls.purge).not.toHaveBeenCalled();
  expect(calls.end).toHaveBeenCalledOnce();
  expect(calls.complete).toHaveBeenCalledWith("policy", "guest-session");
});
test("managed cleanup keeps failed retirement pending for retry", async () => {
  calls.world.mockReturnValue("vercel");
  calls.claim.mockResolvedValueOnce(guest);
  calls.snapshot.mockResolvedValue({ events: [] });
  expect(await cleanupGuestRuntimeSessions()).toMatchObject({
    retiredCount: 0,
    deletedCount: 0,
    pendingCount: 1,
  });
  expect(calls.complete).not.toHaveBeenCalled();
});

test("managed cleanup accepts explicit expired history without claiming erasure", async () => {
  calls.world.mockReturnValue("vercel");
  calls.claim.mockResolvedValueOnce(guest);
  calls.snapshot.mockRejectedValue(
    new ClientError(410, '{"code":"session_expired"}')
  );
  expect(await cleanupGuestRuntimeSessions()).toMatchObject({
    retiredCount: 1,
    deletedCount: 0,
    pendingCount: 0,
  });
  expect(calls.complete).toHaveBeenCalledWith("policy", "guest-session");
});
test.each([404, 401, 503])(
  "managed cleanup does not mistake HTTP %i for expiry",
  async (status) => {
    calls.world.mockReturnValue("vercel");
    calls.claim.mockResolvedValueOnce(guest);
    calls.snapshot.mockRejectedValue(new ClientError(status, "{}"));
    expect(await cleanupGuestRuntimeSessions()).toMatchObject({
      retiredCount: 0,
      deletedCount: 0,
      pendingCount: 1,
    });
    expect(calls.complete).not.toHaveBeenCalled();
  }
);

test("expired drain budget leaves guests pending without claiming another session", async () => {
  calls.world.mockReturnValue("vercel");
  calls.pending.mockReset().mockResolvedValue(2);
  const result = await cleanupGuestRuntimeSessions({
    deadline: Date.now() - 1,
  });
  expect(result.pendingCount).toBe(2);
  expect(calls.claim).not.toHaveBeenCalled();
  expect(calls.complete).not.toHaveBeenCalled();
  expect(calls.prune).not.toHaveBeenCalled();
});
