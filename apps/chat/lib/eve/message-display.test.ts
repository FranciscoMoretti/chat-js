import { defaultMessageReducer } from "eve/client";
import type { MessageStreamEvent } from "eve/client";
import { expect, it } from "vitest";
import { projectEveMessageDisplay } from "./message-display";

const reducer = defaultMessageReducer();
const fold = reducer.reduce.bind(reducer);

const received = (id: string, deliveryId: string): MessageStreamEvent => ({
  type: "message.received",
  meta: { id, at: "2026-10-17T12:00:00Z", deliveryIds: [deliveryId] },
  data: { message: "Identical text", sequence: 0, turnId: "turn_0" },
});

it("projects a known receipt onto the native event identity, never matching text or turn alone", () => {
  const first = received("first", "accepted");
  const second = received("second", "unknown");
  const data = fold(fold(reducer.initial(), first), second);
  const projected = projectEveMessageDisplay(
    data,
    [first, second],
    [{ deliveryId: "accepted", selectedTool: "webSearch" }]
  );
  expect(projected.messages[0]?.metadata?.custom).toEqual({
    chatjs: { selectedTool: "webSearch" },
  });
  expect(projected.messages[1]?.metadata?.custom).toBeUndefined();
  expect(data.messages[0]?.metadata?.custom).toBeUndefined();
  expect(projectEveMessageDisplay(data, [first, second], [])).toBe(data);
});

it("does not decorate ambiguous deliveries or inherited events with a current-session receipt", () => {
  const first = received("first", "accepted");
  const data = fold(reducer.initial(), first);
  const receipts = [
    { deliveryId: "accepted", selectedTool: null },
    { deliveryId: "other", selectedTool: null },
  ];
  expect(
    projectEveMessageDisplay(
      data,
      [
        {
          ...first,
          meta: { ...first.meta, deliveryIds: ["accepted", "other"] },
        },
      ],
      receipts
    )
  ).toBe(data);
  expect(
    projectEveMessageDisplay(
      data,
      [
        {
          type: "history.restored",
          meta: { id: "restore", at: "2026-10-17T12:00:00Z" },
          data: { beforeTurnId: "turn_1", events: [first] },
        },
      ],
      receipts
    )
  ).toBe(data);
});
