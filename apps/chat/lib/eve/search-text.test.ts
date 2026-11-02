import type { SessionStreamEvent } from "eve/client";
import { expect, it } from "vitest";

import { eveEventSearchText } from "@/chatjs/plugins/search/search-text";

const received: SessionStreamEvent = {
  data: {
    parts: [{ text: "saffron rice", kind: "text" }],
    deliveryId: "user-1",
    turnId: "turn_0",
  },
  meta: { at: "2026-09-25T10:00:00Z", position: { line: 0, index: 0 } },
  type: "delivery.consumed",
};
const completed: SessionStreamEvent = {
  data: {
    partId: "assistant-1",
    runId: "run",
    kind: "text",
    phase: "reply",
    value: "Toast the saffron.",
  },
  meta: { at: "2026-09-25T10:00:01Z", position: { line: 1, index: 0 } },
  type: "content.completed",
};
it("projects visible text with stable keys for live events", () => {
  expect(eveEventSearchText(completed)).toEqual([
    { key: "part:assistant-1", text: "Toast the saffron." },
  ]);
  expect(eveEventSearchText(received)).toEqual([
    { key: "delivery:user-1", text: "saffron rice" },
  ]);
});
it("indexes seeded display text while excluding reasoning, tools and model lifecycle events", () => {
  expect(
    eveEventSearchText({
      type: "model.started",
      data: { runId: "run", attempt: 0, modelId: "private/model" },
    })
  ).toEqual([]);
  expect(
    eveEventSearchText({
      data: {
        transcriptSeed: {
          attachments: "channel",
          messages: [
            {
              parts: [
                { text: "visible answer", type: "text" },
                { text: "private thinking", type: "reasoning" },
              ],
              role: "assistant",
            },
          ],
        },
      },
      type: "session.started",
    })
  ).toEqual([{ key: "seed:0", text: "visible answer" }]);
});

it("excludes model text preambles from conversation search", () => {
  expect(
    eveEventSearchText({
      ...completed,
      data: { ...completed.data, phase: "preamble" },
    })
  ).toEqual([]);
});
