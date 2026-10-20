import { expect, it } from "vitest";
import {
  hasSettledWorkspaceOperation,
  hasSettledWorkspaceSession,
} from "./workspace-turn-evidence";
import type { WorkspaceTurnEvent } from "./workspace-turn-evidence";

const received: WorkspaceTurnEvent = {
  type: "message.received",
  data: { turnId: "turn-1" },
  meta: { deliveryIds: ["exact"] },
};
const terminal: WorkspaceTurnEvent = {
  type: "turn.completed",
  data: { turnId: "turn-1" },
};
const waiting: WorkspaceTurnEvent = { type: "session.waiting" };
const operation = { kind: "send", deliveryId: "exact", seeded: false } as const;

it("requires the exact received delivery and its subsequent terminal turn", () => {
  expect(
    hasSettledWorkspaceOperation(operation, [received, terminal, waiting])
  ).toBe(true);
  expect(hasSettledWorkspaceOperation(operation, [terminal, waiting])).toBe(
    false
  );
  expect(
    hasSettledWorkspaceOperation({ ...operation, deliveryId: "unknown" }, [
      received,
      terminal,
      waiting,
    ])
  ).toBe(false);
  expect(
    hasSettledWorkspaceOperation(operation, [terminal, received, waiting])
  ).toBe(false);
  expect(
    hasSettledWorkspaceOperation(operation, [
      received,
      { type: "turn.completed", data: { turnId: "another-turn" } },
      waiting,
    ])
  ).toBe(false);
});

it("keeps approval, delegated work and a newer turn fenced despite earlier completion", () => {
  for (const type of [
    "turn.waiting",
    "turn.started",
    "message.received",
    "step.started",
  ]) {
    expect(
      hasSettledWorkspaceOperation(operation, [
        received,
        terminal,
        waiting,
        { type },
      ])
    ).toBe(false);
    expect(hasSettledWorkspaceSession([waiting, { type }])).toBe(false);
  }
});

it("accepts confirmed cancellation/failure but never cancellation request acknowledgement", () => {
  for (const type of ["turn.cancelled", "turn.failed"]) {
    expect(
      hasSettledWorkspaceOperation(operation, [
        received,
        { type, data: { turnId: "turn-1" } },
        waiting,
      ])
    ).toBe(true);
  }
  expect(
    hasSettledWorkspaceOperation(operation, [
      received,
      { type: "cancel.requested" },
      waiting,
    ])
  ).toBe(false);
});

it("requires positively observed idle state for a seed-only session", () => {
  const seed = { kind: "copy", deliveryId: null, seeded: true } as const;
  expect(hasSettledWorkspaceOperation(seed, [])).toBe(false);
  expect(hasSettledWorkspaceOperation(seed, [waiting])).toBe(true);
  expect(hasSettledWorkspaceOperation(seed, [{ type: "turn.waiting" }])).toBe(
    false
  );
});
