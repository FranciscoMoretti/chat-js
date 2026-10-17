import type { MessageStreamEvent } from "eve/client";
import { expect, it } from "vitest";
import { documentHistoryTurns } from "./document-history";

it("preserves earlier document boundaries through nested copies", () => {
  const meta = { id: "fixture", at: "2026-10-17T00:00:00Z" };
  const events: MessageStreamEvent[] = [
    {
      type: "history.restored",
      meta,
      data: {
        beforeTurnId: "turn_2",
        events: [
          {
            type: "history.restored",
            meta,
            data: {
              beforeTurnId: "turn_1",
              events: [
                {
                  type: "step.started",
                  meta,
                  data: {
                    turnId: "turn_0",
                    sequence: 0,
                    stepIndex: 0,
                    modelId: "fixture",
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ];
  expect(documentHistoryTurns(events)).toEqual([2, 1, 0]);
});
