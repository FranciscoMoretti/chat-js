import { ChildProcess } from "node:child_process";
import { getEventListeners } from "node:events";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { checkHealth } from "./dev-health";
import { supervise } from "./dev-supervisor";

const POLL_MS = 10_000;
const GRACE_MS = 2000;
const BACKOFF_MS = 5000;
const BEFORE_GRACE_MS = GRACE_MS - 1;
const FINAL_GRACE_MS = 1;
const STARTUP_GRACE_MS = 180_000;
const EXTENDED_STARTUP_GRACE_MS = 360_000;
const READY_GRACE_MS = 120_000;
const LAUNCHER_PID = 100;
const WORKER_PID = 101;
const NO_LISTENERS = 0;
const ONE_CHILD = 1;
const TWO_CHILDREN = 2;
const ONE_TIMER = 1;

class FakeChild extends ChildProcess {
  override readonly pid = LAUNCHER_PID;
}

const sleep = async (
  milliseconds: number,
  signal?: AbortSignal
): Promise<void> => {
  signal?.throwIfAborted();
  const completion = Promise.withResolvers<undefined>();
  const timer = setTimeout(() => {
    completion.resolve();
  }, milliseconds);
  const cancel = (): void => {
    clearTimeout(timer);
    completion.reject(new DOMException("Cancelled", "AbortError"));
  };
  signal?.addEventListener("abort", cancel, { once: true });
  try {
    await completion.promise;
  } finally {
    signal?.removeEventListener("abort", cancel);
  }
};

const fixture = (
  cleanup: {
    prepareSandboxCleanup?: (runId: string) => Promise<void>;
    finishSandboxCleanup?: (runId: string) => Promise<void>;
  } = {}
) => {
  const shutdown = new AbortController();
  const children: FakeChild[] = [];
  const kill = vi.fn<(pid: number, signal: NodeJS.Signals) => void>();
  const health = vi.fn<typeof checkHealth>().mockResolvedValue();
  const snapshot = vi.fn(
    () =>
      `${LAUNCHER_PID} 1 launcher-start\n${WORKER_PID} ${LAUNCHER_PID} worker-start`
  );
  const completion = supervise("http://127.0.0.1", shutdown.signal, {
    ...cleanup,
    health,
    kill,
    now: Date.now,
    sleep,
    snapshot,
    start: () => {
      const child = new FakeChild();
      children.push(child);
      return child;
    },
  });
  return { children, completion, health, kill, shutdown, snapshot };
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
  vi.spyOn(console, "info").mockReturnValue();
  vi.spyOn(console, "error").mockReturnValue();
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

test.each(["health", "poll"])(
  "shutdown cancels a pending %s and preserves detached-worker grace",
  async (phase) => {
    const state = fixture();
    if (phase === "health") {
      state.health.mockImplementation(async (_origin, signal) => {
        await sleep(POLL_MS, signal);
      });
      await vi.advanceTimersByTimeAsync(POLL_MS);
    }
    await vi.advanceTimersByTimeAsync(0);
    state.shutdown.abort();
    expect(state.kill).toHaveBeenCalledWith(WORKER_PID, "SIGTERM");
    await vi.advanceTimersByTimeAsync(0);
    expect(vi.getTimerCount()).toBe(ONE_TIMER);
    expect(state.children).toHaveLength(ONE_CHILD);
    await vi.advanceTimersByTimeAsync(BEFORE_GRACE_MS);
    expect(state.kill).not.toHaveBeenCalledWith(WORKER_PID, "SIGKILL");
    await vi.advanceTimersByTimeAsync(FINAL_GRACE_MS);
    await state.completion;
    expect(state.kill).toHaveBeenCalledWith(WORKER_PID, "SIGKILL");
    expect(state.children).toHaveLength(ONE_CHILD);
    expect(vi.getTimerCount()).toBe(NO_LISTENERS);
    expect(getEventListeners(state.shutdown.signal, "abort")).toHaveLength(
      NO_LISTENERS
    );
    for (const child of state.children) {
      expect(child.listenerCount("exit")).toBe(NO_LISTENERS);
      expect(child.listenerCount("error")).toBe(NO_LISTENERS);
    }
  }
);

test.each(["exit", "error"])(
  "child %s cancels a pending health probe before restart cleanup",
  async (event) => {
    const state = fixture();
    state.health.mockImplementation(async (_origin, signal) => {
      await sleep(POLL_MS, signal);
    });
    await vi.advanceTimersByTimeAsync(POLL_MS);
    state.snapshot.mockReturnValue(`${WORKER_PID} 1 worker-start`);
    state.children[0]?.emit(event, new Error("child failed"));
    await vi.advanceTimersByTimeAsync(0);
    expect(state.kill).toHaveBeenCalledWith(WORKER_PID, "SIGTERM");
    expect(vi.getTimerCount()).toBe(ONE_TIMER);
    await vi.advanceTimersByTimeAsync(GRACE_MS + BACKOFF_MS);
    expect(state.kill).toHaveBeenCalledWith(WORKER_PID, "SIGKILL");
    expect(state.children).toHaveLength(TWO_CHILDREN);
    state.shutdown.abort();
    await vi.advanceTimersByTimeAsync(GRACE_MS);
    await state.completion;
    expect(vi.getTimerCount()).toBe(NO_LISTENERS);
  }
);

test("child exit cancels polling, and shutdown cancels restart backoff", async () => {
  const state = fixture();
  await vi.advanceTimersByTimeAsync(0);
  state.children[0]?.emit("exit");
  await vi.advanceTimersByTimeAsync(GRACE_MS);
  expect(vi.getTimerCount()).toBe(ONE_TIMER);
  state.shutdown.abort();
  await state.completion;
  expect(state.children).toHaveLength(ONE_CHILD);
  expect(vi.getTimerCount()).toBe(NO_LISTENERS);
});

test("shutdown during child-exit grace prevents respawn without shortening grace", async () => {
  const state = fixture();
  await vi.advanceTimersByTimeAsync(0);
  state.children[0]?.emit("exit");
  await vi.advanceTimersByTimeAsync(BEFORE_GRACE_MS);
  state.shutdown.abort();
  expect(state.kill).not.toHaveBeenCalledWith(WORKER_PID, "SIGKILL");
  await vi.advanceTimersByTimeAsync(FINAL_GRACE_MS);
  await state.completion;
  expect(state.kill).toHaveBeenCalledWith(WORKER_PID, "SIGKILL");
  expect(state.children).toHaveLength(ONE_CHILD);
});

test("cleanup prunes exited workers and protects reused worker PIDs", async () => {
  const state = fixture();
  await vi.advanceTimersByTimeAsync(0);
  state.shutdown.abort();
  state.snapshot.mockReturnValue(`${WORKER_PID} 1 replacement-start`);
  await vi.advanceTimersByTimeAsync(GRACE_MS);
  await state.completion;
  expect(state.kill).toHaveBeenCalledWith(WORKER_PID, "SIGTERM");
  expect(state.kill).not.toHaveBeenCalledWith(WORKER_PID, "SIGKILL");
  expect(state.kill).not.toHaveBeenCalledWith(LAUNCHER_PID, "SIGKILL");
});

test("a reused launcher PID cannot rediscover unrelated processes during cleanup", async () => {
  const state = fixture();
  await vi.advanceTimersByTimeAsync(0);
  const UNRELATED_PID = 102;
  state.snapshot.mockReturnValue(
    `${LAUNCHER_PID} 1 replacement-start\n${UNRELATED_PID} ${LAUNCHER_PID} unrelated-start\n${WORKER_PID} 1 worker-start`
  );
  state.shutdown.abort();
  await vi.advanceTimersByTimeAsync(GRACE_MS);
  await state.completion;
  expect(state.kill).toHaveBeenCalledWith(WORKER_PID, "SIGTERM");
  expect(state.kill).toHaveBeenCalledWith(WORKER_PID, "SIGKILL");
  expect(state.kill).not.toHaveBeenCalledWith(LAUNCHER_PID, "SIGTERM");
  expect(state.kill).not.toHaveBeenCalledWith(LAUNCHER_PID, "SIGKILL");
  expect(state.kill).not.toHaveBeenCalledWith(UNRELATED_PID, "SIGTERM");
  expect(state.kill).not.toHaveBeenCalledWith(UNRELATED_PID, "SIGKILL");
});

test("an already-aborted shutdown never starts a launcher", async () => {
  const shutdown = new AbortController();
  shutdown.abort();
  const start = vi.fn(() => new FakeChild());
  await supervise("http://127.0.0.1", shutdown.signal, {
    health: vi.fn<typeof checkHealth>().mockResolvedValue(),
    kill: vi.fn<(pid: number, signal: NodeJS.Signals) => void>(),
    now: Date.now,
    sleep,
    snapshot: vi.fn(() => ""),
    start,
  });
  expect(start).not.toHaveBeenCalled();
});

test("readiness recovery keeps failed-start grace and resets it after readiness", async () => {
  const state = fixture();
  state.health.mockRejectedValue(new Error("unavailable"));
  // Terminate before the first probe can report ready, counting a failed start.
  state.children[0]?.emit("exit");
  await vi.advanceTimersByTimeAsync(GRACE_MS + BACKOFF_MS);
  expect(state.children).toHaveLength(TWO_CHILDREN);
  await vi.advanceTimersByTimeAsync(EXTENDED_STARTUP_GRACE_MS - POLL_MS);
  expect(state.children).toHaveLength(TWO_CHILDREN);
  await vi.advanceTimersByTimeAsync(POLL_MS + GRACE_MS + BACKOFF_MS * 2);
  expect(state.children).toHaveLength(3);
  state.health.mockResolvedValue();
  await vi.advanceTimersByTimeAsync(POLL_MS);
  state.health.mockRejectedValue(new Error("unavailable again"));
  await vi.advanceTimersByTimeAsync(READY_GRACE_MS + GRACE_MS + BACKOFF_MS);
  expect(state.children).toHaveLength(4);
  await vi.advanceTimersByTimeAsync(STARTUP_GRACE_MS - POLL_MS);
  expect(state.children).toHaveLength(4);
  await vi.advanceTimersByTimeAsync(POLL_MS + GRACE_MS + BACKOFF_MS * 2);
  expect(state.children).toHaveLength(5);
  state.shutdown.abort();
  await vi.advanceTimersByTimeAsync(GRACE_MS);
  await state.completion;
});

test("persistent cleanup runs after worker termination and uses the prepared run", async () => {
  const prepareSandboxCleanup = vi
    .fn<(runId: string) => Promise<void>>()
    .mockResolvedValue();
  const finishSandboxCleanup = vi
    .fn<(runId: string) => Promise<void>>()
    .mockResolvedValue();
  const state = fixture({ prepareSandboxCleanup, finishSandboxCleanup });
  await vi.advanceTimersByTimeAsync(0);
  state.shutdown.abort();
  expect(finishSandboxCleanup).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(GRACE_MS);
  await state.completion;
  expect(finishSandboxCleanup).toHaveBeenCalledExactlyOnceWith(
    prepareSandboxCleanup.mock.calls[0]?.[0]
  );
  expect(state.kill.mock.invocationCallOrder.at(-1)).toBeLessThan(
    finishSandboxCleanup.mock.invocationCallOrder[0]
  );
});

test("failed recovery prevents a replacement worker from starting", async () => {
  const prepareSandboxCleanup = vi
    .fn<(runId: string) => Promise<void>>()
    .mockRejectedValue(new Error("cleanup unresolved"));
  const state = fixture({ prepareSandboxCleanup });
  await expect(state.completion).rejects.toThrow("cleanup unresolved");
  expect(state.children).toHaveLength(0);
});

test("shutdown during cleanup preparation releases the intent without starting a worker", async () => {
  const prepared = Promise.withResolvers<boolean>();
  const prepareSandboxCleanup = vi
    .fn<(runId: string) => Promise<void>>()
    .mockImplementation(async () => {
      await prepared.promise;
    });
  const finishSandboxCleanup = vi.fn<() => Promise<void>>().mockResolvedValue();
  const state = fixture({ prepareSandboxCleanup, finishSandboxCleanup });
  state.shutdown.abort();
  prepared.resolve(true);
  await state.completion;
  expect(state.children).toHaveLength(0);
  expect(finishSandboxCleanup).toHaveBeenCalledExactlyOnceWith(
    prepareSandboxCleanup.mock.calls[0]?.[0]
  );
});
