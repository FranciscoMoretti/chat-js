import type { MessageStreamEvent } from "eve/client";
import { expect, it } from "vitest";

import { eveEventSearchText } from "@/plugins/search/search-text";

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
it("projects visible text with stable keys for live events", () => {
  expect(eveEventSearchText(completed)).toEqual([
    { key: "event:assistant-1", text: "Toast the saffron." },
  ]);
  expect(eveEventSearchText(received)).toEqual([
    { key: "event:user-1", text: "saffron rice" },
  ]);
});
it("indexes seeded display text while excluding reasoning, tools and model lifecycle events", () => {
  expect(
    eveEventSearchText({
      type: "step.started",
      data: {
        turnId: "turn_0",
        stepIndex: 0,
        sequence: 0,
        modelId: "gateway/private-model",
      },
      meta: received.meta,
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
    } satisfies MessageStreamEvent)
  ).toEqual([{ key: "seed:0", text: "visible answer" }]);
});
