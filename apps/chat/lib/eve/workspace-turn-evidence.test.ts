import { expect, it } from "vitest";
import {
  hasSettledWorkspaceOperation,
  hasSettledWorkspaceSession,
} from "./workspace-turn-evidence";
import type { WorkspaceTurnEvent } from "./workspace-turn-evidence";

const meta = (line: number) => ({
  at: "2026-11-02T00:00:00Z",
  position: { line, index: 0 },
  endOfLine: true,
});
const session: WorkspaceTurnEvent = {
  type: "session.started",
  data: {},
  meta: meta(0),
};
const admitted: WorkspaceTurnEvent = {
  type: "delivery.admitted",
  data: { deliveryId: "exact" },
  meta: meta(1),
};
const started: WorkspaceTurnEvent = {
  type: "turn.started",
  data: { turnId: "turn-1", follows: null, cause: { deliveryId: "exact" } },
  meta: meta(2),
};
const consumed: WorkspaceTurnEvent = {
  type: "delivery.consumed",
  data: {
    turnId: "turn-1",
    deliveryId: "exact",
    parts: [{ kind: "text", text: "Question" }],
  },
  scope: { turnId: "turn-1" },
  meta: meta(3),
};
const handled: WorkspaceTurnEvent = {
  type: "delivery.settled",
  data: { deliveryId: "exact", turnId: "turn-1", outcome: "handled" },
  meta: meta(4),
};
const settled: WorkspaceTurnEvent = {
  type: "turn.settled",
  data: { turnId: "turn-1", outcome: "completed" },
  meta: meta(5),
};
const prefix = [session, admitted, started, consumed];
const completed = [...prefix, handled, settled];
const operation = { kind: "send", deliveryId: "exact", seeded: false } as const;

it("requires the exact consumed delivery and its settled turn", () => {
  expect(hasSettledWorkspaceOperation(operation, completed)).toBe(true);
  expect(hasSettledWorkspaceOperation(operation, [session])).toBe(false);
  expect(
    hasSettledWorkspaceOperation(
      { ...operation, deliveryId: "unknown" },
      completed
    )
  ).toBe(false);
  expect(hasSettledWorkspaceOperation(operation, [...prefix, handled])).toBe(
    false
  );
});

it("keeps paused approvals and later admitted work fenced", () => {
  const paused: WorkspaceTurnEvent = {
    type: "turn.paused",
    data: { turnId: "turn-1", awaiting: [{ interactionId: "approval" }] },
    meta: meta(4),
  };
  expect(hasSettledWorkspaceOperation(operation, [...prefix, paused])).toBe(
    false
  );
  const next: WorkspaceTurnEvent = {
    type: "delivery.admitted",
    data: { deliveryId: "next" },
    meta: meta(6),
  };
  expect(hasSettledWorkspaceOperation(operation, [...completed, next])).toBe(
    false
  );
  expect(hasSettledWorkspaceSession([...completed, next])).toBe(false);
});

it("accepts settled cancellation/failure but not a cancellation command receipt", () => {
  for (const outcome of ["cancelled", "failed"] as const) {
    expect(
      hasSettledWorkspaceOperation(operation, [
        ...prefix,
        handled,
        { ...settled, data: { turnId: "turn-1", outcome } },
      ])
    ).toBe(true);
  }
  const cancel: WorkspaceTurnEvent = {
    type: "delivery.admitted",
    data: { deliveryId: "cancel", source: { control: "cancel" } },
    meta: meta(4),
  };
  expect(hasSettledWorkspaceOperation(operation, [...prefix, cancel])).toBe(
    false
  );
});

it("requires positively observed idle state for a seed-only session", () => {
  const seed = { kind: "copy", deliveryId: null, seeded: true } as const;
  expect(hasSettledWorkspaceOperation(seed, [])).toBe(false);
  expect(hasSettledWorkspaceOperation(seed, [session])).toBe(true);
  expect(hasSettledWorkspaceOperation(seed, prefix)).toBe(false);
});

it("rejects settlement before consumption or for another turn", () => {
  expect(
    hasSettledWorkspaceOperation(operation, [
      session,
      admitted,
      started,
      settled,
      consumed,
      handled,
    ])
  ).toBe(false);
  expect(
    hasSettledWorkspaceOperation(operation, [
      ...prefix,
      handled,
      { ...settled, data: { turnId: "other", outcome: "completed" } },
    ])
  ).toBe(false);
});
