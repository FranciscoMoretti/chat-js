import { expect, it } from "vitest";
import { followupCompletion } from "./followup-completion";

it("uses the durable completion identity for replay", () => {
  const completed = {
    type: "turn.completed",
    data: { turnId: "turn_0" },
    meta: { id: "source-completion" },
  } satisfies Parameters<typeof followupCompletion>[0][number];
  expect(followupCompletion([completed], "turn_0")).toBe("source-completion");
  expect(
    followupCompletion(
      [completed, { ...completed, meta: { id: "branch-completion" } }],
      "turn_0"
    )
  ).toBe("branch-completion");
  expect(followupCompletion([completed], "turn_1")).toBeUndefined();
});

it("never displays seeded suggestions for a new or failed branch turn with the same number", () => {
  const inherited = {
    type: "history.seeded",
  } satisfies Parameters<typeof followupCompletion>[0][number];
  expect(
    followupCompletion(
      [inherited, { type: "turn.started", data: { turnId: "turn_0" } }],
      "turn_0"
    )
  ).toBeUndefined();
  expect(
    followupCompletion(
      [inherited, { type: "turn.failed", data: { turnId: "turn_0" } }],
      "turn_0"
    )
  ).toBeUndefined();
});
