import { beforeEach, expect, it, vi } from "vitest";

import { reconcileEveOwnerUsage } from "./reconcile-usage";

const mocks = vi.hoisted(() => ({
  bindings: vi.fn(),
  cursor: vi.fn(),
  positions: vi.fn(),
  read: vi.fn<(sessionId: string) => Promise<void>>(),
  recover: vi.fn(),
  streamOptions: vi.fn(),
}));
vi.mock("./recover-creations", () => ({ recoverEveCreations: mocks.recover }));
vi.mock("../db/eve-queries", () => ({
  listEveOwnerBindings: mocks.bindings,
}));
vi.mock("../db/eve-billing", () => ({
  advanceEveUsageCursor: vi.fn(),
  getEveUsageCursor: mocks.cursor,
}));
vi.mock("../env", () => ({
  env: { EVE_INTERNAL_ORIGIN: "http://worker.local" },
}));
vi.mock("./stream-positions", () => ({
  getEveStreamPositions: mocks.positions,
}));
vi.mock("./server", () => ({ assertEveConfigured: vi.fn() }));
vi.mock("./activity", () => ({ ingestEveActivity: vi.fn() }));
vi.mock("./usage", () => ({ ingestEveUsage: vi.fn() }));
vi.mock("eve/client", () => ({
  Client: class {
    sessions = {
      attach: (sessionId: string) => ({
        async *stream(options: unknown) {
          mocks.streamOptions(options);
          await mocks.read(sessionId);
          yield* [];
        },
      }),
    };
  },
}));

beforeEach(() => {
  vi.resetAllMocks();
  mocks.cursor.mockResolvedValue(0);
  mocks.positions.mockResolvedValue(new Map());
  mocks.bindings.mockResolvedValue(
    Array.from({ length: 8 }, (_, index) => ({
      sessionId: String(index),
      state: "bound",
      usageStreamIndex: 0,
    }))
  );
});

it("keeps four reads busy when one conversation is slow", async () => {
  const gates = Array.from({ length: 8 }, () =>
    Promise.withResolvers<undefined>()
  );
  mocks.read.mockImplementation((id) => gates[Number(id)].promise);
  const reconciliation = reconcileEveOwnerUsage("owner");
  await expect.poll(() => mocks.read.mock.calls.length).toBe(4);
  gates[1].resolve(undefined);
  await expect.poll(() => mocks.read.mock.calls.length).toBe(5);
  expect(mocks.read.mock.calls.map(([id]) => id)).toEqual([
    "0",
    "1",
    "2",
    "3",
    "4",
  ]);
  for (const gate of gates) {
    gate.resolve(undefined);
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
  const gates = Array.from({ length: 4 }, () =>
    Promise.withResolvers<undefined>()
  );
  mocks.read.mockImplementation((id) => gates[Number(id)].promise);
  let finished = false;
  const reconciliation = reconcileEveOwnerUsage("owner").finally(() => {
    finished = true;
  });
  const rejection = expect(reconciliation).rejects.toThrow("lost stream");
  await expect.poll(() => mocks.read.mock.calls.length).toBe(4);
  gates[1].reject(new Error("lost stream"));
  // Let the failed worker observe the rejection before another read completes.
  // oxlint-disable-next-line promise/avoid-new -- Bridge the timer or abort callback to the awaited operation.
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
  expect(finished).toBe(false);
  for (const gate of gates) {
    gate.resolve(undefined);
  }
  await rejection;
  expect(mocks.read).toHaveBeenCalledTimes(4);
});

it("rejects uncertain ownership bindings before reading any stream", async () => {
  mocks.bindings.mockResolvedValue([
    { sessionId: "owned", state: "bound" },
    { sessionId: null, state: "uncertain" },
  ]);
  await expect(reconcileEveOwnerUsage("owner")).rejects.toThrow(
    "Resolve uncertain session creation"
  );
  expect(mocks.read).not.toHaveBeenCalled();
  expect(mocks.positions).not.toHaveBeenCalled();
});

it("skips only streams whose exact position matches the durable billing cursor", async () => {
  mocks.bindings.mockResolvedValue([
    { sessionId: "settled", state: "bound", usageStreamIndex: 10 },
    { sessionId: "appended", state: "bound", usageStreamIndex: 10 },
    { sessionId: "missing", state: "bound", usageStreamIndex: 0 },
  ]);
  mocks.positions.mockResolvedValue(
    new Map([
      ["settled", 10],
      ["appended", 11],
    ])
  );
  await reconcileEveOwnerUsage("owner");
  expect(mocks.read.mock.calls.map(([id]) => id)).toEqual([
    "appended",
    "missing",
  ]);
});

it("refuses a stream shorter than its durable billing cursor", async () => {
  mocks.bindings.mockResolvedValue([
    { sessionId: "rewound", state: "bound", usageStreamIndex: 10 },
  ]);
  mocks.positions.mockResolvedValue(new Map([["rewound", 9]]));
  await expect(reconcileEveOwnerUsage("owner")).rejects.toThrow(
    "shorter than its durable billing cursor"
  );
  expect(mocks.read).not.toHaveBeenCalled();
});

it("fails closed when authoritative stream positions cannot be read", async () => {
  mocks.positions.mockRejectedValue(new Error("world unavailable"));
  await expect(reconcileEveOwnerUsage("owner")).rejects.toThrow(
    "world unavailable"
  );
  expect(mocks.read).not.toHaveBeenCalled();
});

it("finishes interrupted commands before selecting usage streams", async () => {
  mocks.recover.mockImplementation(() => {
    mocks.bindings.mockResolvedValue([
      { sessionId: "recovered", state: "bound", usageStreamIndex: 0 },
    ]);
  });
  await reconcileEveOwnerUsage("owner");
  expect(mocks.recover).toHaveBeenCalledWith("owner");
  expect(mocks.read).toHaveBeenCalledWith("recovered");
});
it("does not admit new work when recovery remains unavailable", async () => {
  mocks.recover.mockRejectedValue(new Error("worker unavailable"));
  await expect(reconcileEveOwnerUsage("owner")).rejects.toThrow(
    "worker unavailable"
  );
  expect(mocks.bindings).not.toHaveBeenCalled();
});

it("resumes managed reads at the persisted billing cursor without following live work", async () => {
  mocks.bindings.mockResolvedValue([
    { sessionId: "session", state: "bound", usageStreamIndex: 17 },
  ]);
  mocks.cursor.mockResolvedValue(17);
  await reconcileEveOwnerUsage("owner");
  expect(mocks.streamOptions).toHaveBeenCalledWith(
    expect.objectContaining({ follow: false, startIndex: 17 })
  );
});
