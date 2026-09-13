import { expect, it } from "vitest";

import { followupContext } from "./followup-context";
import { messageFollowupSuggestions } from "./followup-suggestions";

const meta = { at: "2026-09-12T00:00:00Z", id: "event" };
const suggestions = [
  "What is next?",
  "Why is this useful?",
  "Can you show an example?",
];
it("reads only the dedicated annotation and ignores malformed optional content", () => {
  expect(
    messageFollowupSuggestions({
      metadata: { annotations: { "followup-suggestions": { suggestions } } },
    })
  ).toEqual(suggestions);
  expect(
    messageFollowupSuggestions({
      metadata: { custom: { "followup-suggestions": { suggestions } } },
    })
  ).toEqual([]);
  expect(
    messageFollowupSuggestions({
      metadata: {
        annotations: {
          "followup-suggestions": {
            suggestions: ["x".repeat(81), ...suggestions],
          },
        },
      },
    })
  ).toEqual([]);
  expect(messageFollowupSuggestions({})).toEqual([]);
});
it("keeps only bounded current-turn text and excludes tool-call preambles", () => {
  const blank = followupContext(
    { assistant: "Previous answer", user: "Previous" },
    { data: { sequence: 1, turnId: "turn_1" }, meta, type: "turn.started" }
  );
  expect(blank).toEqual({ assistant: "", user: "" });
  const received = followupContext(blank, {
    data: { message: "a".repeat(20_000), sequence: 1, turnId: "turn_1" },
    meta,
    type: "message.received",
  });
  expect(received.user).toHaveLength(12_000);
  expect(
    followupContext(received, {
      data: {
        finishReason: "tool-calls",
        message: "Calling a tool",
        sequence: 1,
        stepIndex: 0,
        turnId: "turn_1",
      },
      meta,
      type: "message.completed",
    })
  ).toEqual(received);
  const completed = followupContext(received, {
    data: {
      finishReason: "stop",
      message: "Final answer",
      sequence: 1,
      stepIndex: 1,
      turnId: "turn_1",
    },
    meta,
    type: "message.completed",
  });
  expect(completed.assistant).toBe("Final answer");
});
