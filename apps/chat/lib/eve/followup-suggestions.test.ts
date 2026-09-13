import { expect, it } from "vitest";

import { followupContext } from "./followup-context";
import { messageFollowupSuggestions } from "./followup-suggestions";

const meta = { id: "event", at: "2026-09-12T00:00:00Z" };
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
    { user: "Previous", assistant: "Previous answer" },
    { type: "turn.started", meta, data: { sequence: 1, turnId: "turn_1" } }
  );
  expect(blank).toEqual({ user: "", assistant: "" });
  const received = followupContext(blank, {
    type: "message.received",
    meta,
    data: { message: "a".repeat(20_000), sequence: 1, turnId: "turn_1" },
  });
  expect(received.user).toHaveLength(12_000);
  expect(
    followupContext(received, {
      type: "message.completed",
      meta,
      data: {
        message: "Calling a tool",
        finishReason: "tool-calls",
        sequence: 1,
        stepIndex: 0,
        turnId: "turn_1",
      },
    })
  ).toEqual(received);
  const completed = followupContext(received, {
    type: "message.completed",
    meta,
    data: {
      message: "Final answer",
      finishReason: "stop",
      sequence: 1,
      stepIndex: 1,
      turnId: "turn_1",
    },
  });
  expect(completed.assistant).toBe("Final answer");
});
