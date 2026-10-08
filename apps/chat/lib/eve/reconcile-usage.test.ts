import { beforeEach, expect, it, vi } from "vitest";
import type { MessageStreamEvent } from "eve/client";
import { reconcileEveOwnerUsage } from "./reconcile-usage";
import type { withManagedUsageReconciliation } from "@/lib/db/eve-billing";

const mocks = vi.hoisted(() => ({
  advanceChild: vi.fn(),
  bindings: vi.fn(),
  child: vi.fn(),
  children: vi.fn(),
  cursor: vi.fn(),
  env: {
    EVE_INTERNAL_ORIGIN: "http://worker.local",
    VERCEL: "",
    VERCEL_ENV: "preview",
  },
  events: new Map<string, MessageStreamEvent[]>(),
  ingest: vi.fn(),
  managed: vi.fn<typeof withManagedUsageReconciliation>(),
  positions: vi.fn(),
  read: vi.fn<(sessionId: string) => Promise<void>>(),
  recover: vi.fn(),
  streamOptions: vi.fn(),
}));
vi.mock("../db/eve-subagents", () => ({
  advanceEveSubagentUsageCursor: mocks.advanceChild,
  getEveSubagent: mocks.child,
  listEveSubagents: mocks.children,
}));
vi.mock("./recover-creations", () => ({ recoverEveCreations: mocks.recover }));
vi.mock("../db/eve-queries", () => ({
  listEveOwnerBindings: mocks.bindings,
}));
vi.mock("../db/eve-billing", () => ({
  advanceEveUsageCursor: vi.fn(),
  getEveUsageCursor: mocks.cursor,
  withManagedUsageReconciliation: mocks.managed,
}));
vi.mock("../env", () => ({
  env: mocks.env,
}));
vi.mock("./stream-positions", () => ({
  getEveStreamPositions: mocks.positions,
}));
vi.mock("./server", () => ({ assertEveConfigured: vi.fn() }));
vi.mock("./activity", () => ({ ingestEveActivity: vi.fn() }));
vi.mock("./usage", () => ({ ingestEveUsage: mocks.ingest }));
vi.mock("eve/client", () => ({
  Client: class {
    public sessions = {
      attach: (
        sessionId: string
      ): {
        stream: (options: unknown) => AsyncGenerator<MessageStreamEvent, void>;
      } => ({
        /* oxlint-disable oxc/no-async-await -- Modern targets support the async-iterator protocol; preserve stream's asynchronous iteration and rejection behavior. */
        async *stream(
          options: unknown
        ): AsyncGenerator<MessageStreamEvent, void> {
          mocks.streamOptions(options);
          await mocks.read(sessionId);
          yield* mocks.events.get(sessionId) ?? [];
        },
        /* oxlint-enable oxc/no-async-await */
      }),
    };
  },
}));

/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): beforeEach uses 0 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
beforeEach(() => {
  vi.resetAllMocks();
  mocks.events.clear();
  mocks.ingest.mockResolvedValue(true);
  mocks.env.VERCEL = "";
  mocks.children.mockResolvedValue([]);
  mocks.cursor.mockResolvedValue(0);
  mocks.positions.mockResolvedValue(new Map());
  mocks.bindings.mockResolvedValue(
    Array.from({ length: 8 }, (_value, index) => ({
      sessionId: String(index),
      state: "bound",
      usageStreamIndex: 0,
    }))
  );
});
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-magic-numbers */

/* oxlint-disable max-statements, no-magic-numbers, no-undefined, typescript/promise-function-async --
 * max-statements (#512): it("keeps four reads busy when one conversation is slow") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): it("keeps four reads busy when one conversation is slow") uses 4, 1, 5 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * no-undefined (#519): it("keeps four reads busy when one conversation is slow") uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * typescript/promise-function-async (#606): it("keeps four reads busy when one conversation is slow") preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
it("keeps four reads busy when one conversation is slow", async () => {
  const gates = Array.from({ length: 8 }, () =>
    Promise.withResolvers<undefined>()
  );
  mocks.read.mockImplementation((id) => gates[Number(id)].promise);
  const reconciliation = reconcileEveOwnerUsage("owner");
  await expect.poll(() => mocks.read.mock.calls.length).toBe(4);
  gates[1].resolve(undefined);
  await expect.poll(() => mocks.read.mock.calls.length).toBe(5);
  expect(
    mocks.read.mock.calls.map(([id]: Readonly<[sessionId: string]>) => id)
  ).toEqual(["0", "1", "2", "3", "4"]);
  for (const gate of gates) {
    gate.resolve(undefined);
  }
  await reconciliation;
  expect(
    mocks.read.mock.calls.map(([id]: Readonly<[sessionId: string]>) => id)
  ).toEqual(["0", "1", "2", "3", "4", "5", "6", "7"]);
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable max-statements, no-magic-numbers, no-undefined, typescript/promise-function-async */

/* oxlint-disable max-statements, no-magic-numbers, no-undefined, typescript/promise-function-async --
 * max-statements (#512): it("stops scheduling on failure and waits for in-flight billing reads") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): it("stops scheduling on failure and waits for in-flight billing reads") uses 4, 1, 0 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * no-undefined (#519): it("stops scheduling on failure and waits for in-flight billing reads") uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * typescript/promise-function-async (#606): it("stops scheduling on failure and waits for in-flight billing reads") preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
it("stops scheduling on failure and waits for in-flight billing reads", async () => {
  const gates = Array.from({ length: 4 }, () =>
    Promise.withResolvers<undefined>()
  );
  mocks.read.mockImplementation((id) => gates[Number(id)].promise);
  let finished = false;
  // oxlint-disable-next-line promise/prefer-await-to-then -- Observe settlement without blocking the assertions on still-pending billing reads.
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable max-statements, no-magic-numbers, no-undefined, typescript/promise-function-async */

/* oxlint-disable unicorn/no-null --
 * unicorn/no-null (#570): it("rejects uncertain ownership bindings before reading any stream") preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable unicorn/no-null */

/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): it("skips only streams whose exact position matches the durable billing cursor") uses 10, 11 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
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
  expect(
    mocks.read.mock.calls.map(([id]: Readonly<[sessionId: string]>) => id)
  ).toEqual(["appended", "missing"]);
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-magic-numbers */

/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): it("refuses a stream shorter than its durable billing cursor") uses 9 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-magic-numbers */

it("fails closed when authoritative stream positions cannot be read", async () => {
  mocks.positions.mockRejectedValue(new Error("world unavailable"));
  await expect(reconcileEveOwnerUsage("owner")).rejects.toThrow(
    "world unavailable"
  );
  expect(mocks.read).not.toHaveBeenCalled();
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
it("does not admit new work when recovery remains unavailable", async () => {
  mocks.recover.mockRejectedValue(new Error("worker unavailable"));
  await expect(reconcileEveOwnerUsage("owner")).rejects.toThrow(
    "worker unavailable"
  );
  expect(mocks.bindings).not.toHaveBeenCalled();
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): it("resumes managed reads at the persisted billing cursor without following live work uses 17 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-magic-numbers */

/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): it("reconciles only the target during a managed owner cooldown, then sweeps when due" uses 8 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
it("reconciles only the target during a managed owner cooldown, then sweeps when due", async () => {
  mocks.env.VERCEL = "1";
  // oxlint-disable-next-line typescript/promise-function-async -- Forward the reconciliation promise directly so this scheduling fixture observes its original settlement.
  mocks.managed.mockImplementationOnce((_owner, reconcile) =>
    reconcile(false, new Set())
  );
  await reconcileEveOwnerUsage("owner", "target");
  expect(mocks.read.mock.calls).toEqual([["target"]]);
  expect(mocks.bindings).not.toHaveBeenCalled();
  mocks.read.mockClear();
  // oxlint-disable-next-line typescript/promise-function-async -- Forward the reconciliation promise directly so this scheduling fixture observes its original settlement.
  mocks.managed.mockImplementationOnce((_owner, reconcile) =>
    reconcile(true, new Set())
  );
  await reconcileEveOwnerUsage("owner", "target");
  expect(mocks.read).toHaveBeenCalledTimes(8);
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-magic-numbers */

it("does not bypass managed reconciliation failures", async () => {
  mocks.env.VERCEL = "1";
  mocks.managed.mockRejectedValue(new Error("Unpriced usage"));
  await expect(reconcileEveOwnerUsage("owner", "target")).rejects.toThrow(
    "Unpriced usage"
  );
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): it("replays historical unpriced evidence even when its stream cursor already advanced uses 20 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
it("replays historical unpriced evidence even when its stream cursor already advanced", async () => {
  mocks.env.VERCEL = "1";
  mocks.bindings.mockResolvedValue([
    { sessionId: "failed-attempt", state: "bound", usageStreamIndex: 20 },
  ]);
  mocks.cursor.mockResolvedValue(20);
  // oxlint-disable-next-line typescript/promise-function-async -- Forward the reconciliation promise directly so this scheduling fixture observes its original settlement.
  mocks.managed.mockImplementationOnce((_owner, reconcile) =>
    reconcile(false, new Set(["failed-attempt"]))
  );
  await reconcileEveOwnerUsage("owner", "failed-attempt");
  expect(mocks.streamOptions).toHaveBeenCalledWith(
    expect.objectContaining({ startIndex: 0 })
  );
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-magic-numbers */

/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): it("reconciles child tails even when the root cursor is unchanged and preserves origi uses 20, 3 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
it("reconciles child tails even when the root cursor is unchanged and preserves original event identity", async () => {
  mocks.bindings.mockResolvedValue([
    { sessionId: "root", state: "bound", usageStreamIndex: 20 },
  ]);
  mocks.cursor.mockResolvedValue(20);
  mocks.positions.mockResolvedValue(
    new Map([
      ["root", 20],
      ["child", 3],
    ])
  );
  mocks.children.mockResolvedValue([
    {
      rootSessionId: "root",
      rootTurnId: "turn_4",
      sessionId: "child",
      usageStreamIndex: 2,
    },
  ]);
  const event: MessageStreamEvent = {
    data: {
      code: "cancelled",
      message: "Cancelled",
      sequence: 0,
      stepIndex: 0,
      turnId: "turn_0",
    },
    meta: { at: "2026-09-28T00:00:00Z", id: "child-event" },
    type: "step.failed",
  };
  mocks.events.set("child", [event]);
  await reconcileEveOwnerUsage("owner");
  expect(mocks.read.mock.calls).toEqual([["root"], ["child"]]);
  expect(mocks.ingest).toHaveBeenCalledWith("owner", "child", event, {
    sessionId: "root",
    turnId: "turn_4",
  });
  expect(mocks.advanceChild).toHaveBeenCalledWith("owner", "child", 3);
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-magic-numbers */

it("blocks admission without advancing child progress when a completed child charge remains unknown", async () => {
  mocks.bindings.mockResolvedValue([
    { sessionId: "root", state: "bound", usageStreamIndex: 0 },
  ]);
  mocks.children.mockResolvedValue([
    {
      rootSessionId: "root",
      rootTurnId: "turn_2",
      sessionId: "child",
      usageStreamIndex: 0,
    },
  ]);
  mocks.events.set("child", [
    {
      data: {
        hookId: "auxiliary",
        modelCalls: [{ modelId: "model" }],
        turnId: "turn_0",
      },
      meta: { at: "2026-09-28T00:00:00Z", id: "unpriced" },
      type: "hook.result",
    },
  ]);
  mocks.ingest.mockResolvedValue(false);
  await expect(reconcileEveOwnerUsage("owner")).rejects.toThrow(
    "Completed usage needs provider cost reconciliation"
  );
  expect(mocks.advanceChild).not.toHaveBeenCalled();
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
it("settles newly discovered descendants before admitting the next turn", async () => {
  mocks.bindings.mockResolvedValue([
    { sessionId: "root", state: "bound", usageStreamIndex: 0 },
  ]);
  mocks.children.mockResolvedValue([
    {
      rootSessionId: "root",
      rootTurnId: "turn_1",
      sessionId: "child",
      usageStreamIndex: 0,
    },
  ]);
  mocks.child.mockResolvedValue({
    rootSessionId: "root",
    rootTurnId: "turn_1",
    sessionId: "grandchild",
    usageStreamIndex: 0,
  });
  mocks.events.set("child", [
    {
      data: {
        callId: "call",
        childSessionId: "grandchild",
        childStreamPath: "/stream",
        name: "worker",
        sequence: 0,
        sessionId: "child",
        toolName: "worker",
        turnId: "turn_0",
        workflowId: "workflow",
      },
      meta: { at: "2026-09-28T00:00:00Z", id: "delegation" },
      type: "subagent.called",
    },
  ]);
  await reconcileEveOwnerUsage("owner");
  expect(mocks.read.mock.calls).toEqual([["root"], ["child"], ["grandchild"]]);
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): it("skips settled research history with one owner-wide child lookup") uses 20, 5, 3 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
it("skips settled research history with one owner-wide child lookup", async () => {
  mocks.bindings.mockResolvedValue([
    { sessionId: "root", state: "bound", usageStreamIndex: 20 },
    { sessionId: "other", state: "bound", usageStreamIndex: 5 },
  ]);
  mocks.children.mockResolvedValue([
    {
      rootSessionId: "root",
      rootTurnId: "turn",
      sessionId: "child",
      usageStreamIndex: 3,
    },
  ]);
  mocks.positions.mockResolvedValue(
    new Map([
      ["root", 20],
      ["other", 5],
      ["child", 3],
    ])
  );
  await reconcileEveOwnerUsage("owner");
  expect(mocks.children).toHaveBeenCalledExactlyOnceWith("owner");
  expect(mocks.positions).toHaveBeenCalledExactlyOnceWith([
    "root",
    "other",
    "child",
  ]);
  expect(mocks.read).not.toHaveBeenCalled();
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-magic-numbers */

/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): it("rejects a rewound child even when its parent is settled") uses 20, 2 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
it("rejects a rewound child even when its parent is settled", async () => {
  mocks.bindings.mockResolvedValue([
    { sessionId: "root", state: "bound", usageStreamIndex: 20 },
  ]);
  mocks.children.mockResolvedValue([
    {
      rootSessionId: "root",
      rootTurnId: "turn",
      sessionId: "child",
      usageStreamIndex: 3,
    },
  ]);
  mocks.positions.mockResolvedValue(
    new Map([
      ["root", 20],
      ["child", 2],
    ])
  );
  await expect(reconcileEveOwnerUsage("owner")).rejects.toThrow(
    "child stream is shorter"
  );
  expect(mocks.read).not.toHaveBeenCalled();
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable no-magic-numbers */

/* oxlint-disable max-lines -- #509: This reconcile-usage.test.ts module keeps its existing fixture/scenario boundaries; splitting it requires an ownership design. EOF-scoped exception applies only to this file-level line metric. */
