import type { MessageStreamEvent } from "eve/client";
import { expect, it } from "vitest";

import { eveCopyBoundaries } from "./copy-boundaries";

it("distinguishes imported boundaries from new native turns that restart at zero", () => {
  const events: MessageStreamEvent[] = [
    {
      data: {
        messages: [
          {
            id: "seed_message_0",
            parts: [{ text: "imported", type: "text" }],
            role: "user",
          },
          {
            id: "seed_message_1",
            parts: [{ text: "answer", type: "text" }],
            role: "assistant",
          },
        ],
      },
      meta: { at: "2026-09-12T00:00:00Z", id: "seed" },
      type: "history.seeded",
    },
    {
      data: { message: "new question", sequence: 0, turnId: "turn_0" },
      meta: { at: "2026-09-12T00:00:01Z", id: "new" },
      type: "message.received",
    },
  ];
  expect(eveCopyBoundaries(events)).toEqual([
    { messageIndex: 0, sourceIndex: 0, sourceKind: "imported" },
    { messageIndex: 2, sourceIndex: 0, sourceKind: "turn" },
  ]);
});
