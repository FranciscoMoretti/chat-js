import type { MessageStreamEvent } from "eve/client";
import { expect, it } from "vitest";

import { eveEventSearchText } from "./search-text";

const received: MessageStreamEvent = {
  data: {
    message: "fallback",
    parts: [{ text: "saffron rice", type: "text" }],
    sequence: 0,
    turnId: "turn_0",
  },
  meta: { at: "2026-09-25T10:00:00Z", id: "user-1" },
  type: "message.received",
};
const completed: MessageStreamEvent = {
  data: {
    finishReason: "stop",
    message: "Toast the saffron.",
    sequence: 1,
    stepIndex: 0,
    turnId: "turn_0",
  },
  meta: { at: "2026-09-25T10:00:01Z", id: "assistant-1" },
  type: "message.completed",
};
it("projects visible text with stable keys for live events and restored history", () => {
  const restored: MessageStreamEvent = {
    data: {
      beforeTurnId: "turn_1",
      events: [received, completed],
      sourceSessionId: "source",
    },
    meta: { at: received.meta.at, id: "history" },
    type: "history.restored",
  };
  expect(eveEventSearchText(restored)).toEqual([
    ...eveEventSearchText(received),
    ...eveEventSearchText(completed),
  ]);
  expect(eveEventSearchText(received)).toEqual([
    { key: "event:user-1", text: "saffron rice" },
  ]);
});
it("indexes seeded display text while excluding reasoning, tools and system-authored input", () => {
  expect(
    eveEventSearchText({
      ...received,
      data: { ...received.data, kind: "execution.background_task" },
    })
  ).toEqual([]);
  expect(
    eveEventSearchText({
      data: {
        messages: [
          {
            id: "seed_message_0",
            parts: [
              { text: "visible answer", type: "text" },
              { text: "private thinking", type: "reasoning" },
            ],
            role: "assistant",
          },
        ],
      },
      meta: received.meta,
      type: "history.seeded",
    })
  ).toEqual([{ key: "seed:0", text: "visible answer" }]);
});
