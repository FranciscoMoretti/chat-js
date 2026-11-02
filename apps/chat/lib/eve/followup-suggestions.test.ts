import { expect, it } from "vitest";

import { followupContext } from "@/chatjs/plugins/followup-suggestions/followup-context";

it("keeps only bounded current-turn text and excludes tool-call preambles", () => {
  const blank = followupContext(
    { assistant: "Previous answer", user: "Previous" },
    {
      data: {
        turnId: "turn_1",
        cause: { deliveryId: "delivery" },
        follows: null,
      },
      type: "turn.started",
    }
  );
  expect(blank).toEqual({ assistant: "", user: "" });
  const received = followupContext(blank, {
    data: {
      parts: [{ kind: "text", text: "a".repeat(20_000) }],
      deliveryId: "delivery",
      turnId: "turn_1",
    },
    type: "delivery.consumed",
  });
  expect(received.user).toHaveLength(12_000);
  expect(
    followupContext(received, {
      data: {
        partId: "preamble",
        runId: "run",
        kind: "text",
        phase: "preamble",
        value: "Calling a tool",
      },
      type: "content.completed",
    })
  ).toEqual(received);
  const completed = followupContext(received, {
    data: {
      partId: "answer",
      runId: "run",
      kind: "text",
      phase: "reply",
      value: "Final answer",
    },
    type: "content.completed",
  });
  expect(completed.assistant).toBe("Final answer");
});
