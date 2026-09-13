import type { MessageStreamEvent } from "eve/client";
import { expect, it } from "vitest";

import { eveCopyBoundaries } from "./copy-boundaries";

it("distinguishes imported boundaries from new native turns that restart at zero", () => {
  const events: MessageStreamEvent[] = [
    {
      type: "history.seeded",
      meta: { id: "seed", at: "2026-09-12T00:00:00Z" },
      data: {
        messages: [
          {
            id: "seed_message_0",
            role: "user",
            parts: [{ type: "text", text: "imported" }],
          },
          {
            id: "seed_message_1",
            role: "assistant",
            parts: [{ type: "text", text: "answer" }],
          },
        ],
      },
    },
    {
      type: "message.received",
      meta: { id: "new", at: "2026-09-12T00:00:01Z" },
      data: { message: "new question", sequence: 0, turnId: "turn_0" },
    },
  ];
  expect(eveCopyBoundaries(events)).toEqual([
    { messageIndex: 0, sourceKind: "imported", sourceIndex: 0 },
    { messageIndex: 2, sourceKind: "turn", sourceIndex: 0 },
  ]);
});
