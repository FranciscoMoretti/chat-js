import { beforeEach, expect, it, vi } from "vitest";
import { reconcileEveOwnerUsage } from "./reconcile-usage";

const mocks = vi.hoisted(() => ({
  bindings: vi.fn(),
  read: vi.fn<(sessionId: string) => Promise<void>>(),
}));
vi.mock("../db/eve-queries", () => ({
  listEveOwnerBindings: mocks.bindings,
}));
vi.mock("../db/eve-billing", () => ({
  getEveUsageCursor: async () => 0,
  advanceEveUsageCursor: vi.fn(),
}));
vi.mock("../env", () => ({ env: {} }));
vi.mock("./server", () => ({ assertEveConfigured: vi.fn() }));
vi.mock("./activity", () => ({ ingestEveActivity: vi.fn() }));
vi.mock("./usage", () => ({ ingestEveUsage: vi.fn() }));
vi.mock("eve/client", () => ({
  Client: class {
    sessions = {
      attach: (sessionId: string) => ({
        async *stream() {
          await mocks.read(sessionId);
          yield* [];
        },
      }),
    };
  },
}));

beforeEach(() => {
  vi.resetAllMocks();
  mocks.bindings.mockResolvedValue(
    Array.from({ length: 8 }, (_, index) => ({
      sessionId: String(index),
      state: "bound",
    }))
  );
});

it("keeps four reads busy when one conversation is slow", async () => {
  const gates = Array.from({ length: 8 }, () => Promise.withResolvers<void>());
  mocks.read.mockImplementation((id) => gates[Number(id)].promise);
  const reconciliation = reconcileEveOwnerUsage("owner");
  await expect.poll(() => mocks.read.mock.calls.length).toBe(4);
  gates[1].resolve();
  await expect.poll(() => mocks.read.mock.calls.length).toBe(5);
  expect(mocks.read.mock.calls.map(([id]) => id)).toEqual([
    "0",
    "1",
    "2",
    "3",
    "4",
  ]);
  for (const gate of gates) {
    gate.resolve();
  }
  await reconciliation;
  expect(mocks.read.mock.calls.map(([id]) => id)).toEqual([
    "0",
    "1",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
  ]);
});

it("stops scheduling on failure and waits for in-flight billing reads", async () => {
  const gates = Array.from({ length: 4 }, () => Promise.withResolvers<void>());
  mocks.read.mockImplementation((id) => gates[Number(id)].promise);
  let finished = false;
  const reconciliation = reconcileEveOwnerUsage("owner").finally(() => {
    finished = true;
  });
  const rejection = expect(reconciliation).rejects.toThrow("lost stream");
  await expect.poll(() => mocks.read.mock.calls.length).toBe(4);
  gates[1].reject(new Error("lost stream"));
  // Let the failed worker observe the rejection before another read completes.
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(finished).toBe(false);
  for (const gate of gates) {
    gate.resolve();
  }
  await rejection;
  expect(mocks.read).toHaveBeenCalledTimes(4);
});

it("rejects uncertain ownership bindings before reading any stream", async () => {
  mocks.bindings.mockResolvedValue([
    { state: "bound", sessionId: "owned" },
    { state: "uncertain", sessionId: null },
  ]);
  await expect(reconcileEveOwnerUsage("owner")).rejects.toThrow(
    "Resolve uncertain session creation"
  );
  expect(mocks.read).not.toHaveBeenCalled();
});
