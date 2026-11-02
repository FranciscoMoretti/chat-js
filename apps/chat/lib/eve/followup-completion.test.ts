import { expect, it } from "vitest";
import type { SessionStreamEvent } from "eve/client";
import { followupCompletion } from "@/chatjs/plugins/followup-suggestions/followup-completion";

const completed = {
  type: "turn.settled",
  data: { turnId: "turn_0", outcome: "completed" },
  meta: { at: "2026-11-02T00:00:00Z", position: { line: 1, index: 0 } },
} satisfies SessionStreamEvent;

it("uses the native turn completion identity consistently across replay", () => {
  expect(followupCompletion([completed], "turn_0")).toBe(
    "turn:turn_0:completed"
  );
  expect(followupCompletion([completed, completed], "turn_0")).toBe(
    "turn:turn_0:completed"
  );
  expect(followupCompletion([completed], "turn_1")).toBeUndefined();
});

it("does not reuse suggestions for a new or unsuccessfully settled turn", () => {
  expect(followupCompletion([], "turn_0")).toBeUndefined();
  const started = {
    type: "turn.started",
    data: {
      turnId: "turn_0",
      follows: null,
      cause: { deliveryId: "delivery" },
    },
    meta: { at: "2026-11-02T00:00:01Z", position: { line: 2, index: 0 } },
  } satisfies SessionStreamEvent;
  expect(followupCompletion([completed, started], "turn_0")).toBeUndefined();
  for (const outcome of ["failed", "cancelled"] as const) {
    expect(
      followupCompletion(
        [completed, { ...completed, data: { turnId: "turn_0", outcome } }],
        "turn_0"
      )
    ).toBeUndefined();
  }
});
