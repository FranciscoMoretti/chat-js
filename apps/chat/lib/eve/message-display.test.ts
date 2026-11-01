import { defaultMessageReducer } from "eve/client";
import type { MessageStreamEvent } from "eve/client";
import { expect, it } from "vitest";
import type { EveMessageDisplayReceipt } from "./message-display";
import { projectEveMessageDisplay } from "./message-display";

const reducer = defaultMessageReducer();
const fold = reducer.reduce.bind(reducer);

const received = (id: string, deliveryId: string): MessageStreamEvent => ({
  type: "message.received",
  meta: { id, at: "2026-10-17T12:00:00Z", deliveryIds: [deliveryId] },
  data: { message: "Identical text", sequence: 0, turnId: "turn_0" },
});

const started = (deliveryIds: readonly string[]): MessageStreamEvent => ({
  type: "session.started",
  data: {},
  meta: { id: "start", at: "2026-10-17T12:00:00Z", deliveryIds },
});

it("correlates a bound initial selection through native session-start delivery metadata", () => {
  const first = received("initial", "initial-delivery");
  const later = received("later", "later-delivery");
  const data = fold(fold(reducer.initial(), first), later);
  const receipt: EveMessageDisplayReceipt = {
    kind: "initial",
    selectedTool: "webSearch",
  };
  const events = [started(["initial-delivery"]), first, later];
  expect(
    projectEveMessageDisplay(data, events, [receipt]).messages[0]?.metadata
      ?.custom
  ).toEqual({ chatjs: { selectedTool: "webSearch" } });
  expect(
    projectEveMessageDisplay(data, events, [receipt]).messages[1]?.metadata
      ?.custom
  ).toBeUndefined();
  const unproven: MessageStreamEvent[][] = [
    [first, later],
    [started([]), first, later],
    [started(["initial-delivery", "later-delivery"]), first, later],
    [started(["initial-delivery"]), started(["initial-delivery"]), first],
    [
      started(["initial-delivery"]),
      first,
      received("coalesced", "initial-delivery"),
    ],
    [
      started(["initial-delivery"]),
      {
        ...first,
        meta: {
          ...first.meta,
          deliveryIds: ["initial-delivery", "unknown-delivery"],
        },
      },
    ],
    [
      {
        type: "history.seeded",
        meta: { id: "restored", at: "2026-10-17T12:00:00Z" },
        data: { messages: data.messages },
      },
      later,
    ],
  ];
  for (const ambiguous of unproven) {
    expect(projectEveMessageDisplay(data, ambiguous, [receipt])).toBe(data);
  }
  expect(projectEveMessageDisplay(data, events, [receipt, receipt])).toBe(data);
  expect(projectEveMessageDisplay(data, events, [])).toBe(data);
});

it("projects a known receipt onto the native event identity, never matching text or turn alone", () => {
  const first = received("first", "accepted");
  const second = received("second", "unknown");
  const data = fold(fold(reducer.initial(), first), second);
  const projected = projectEveMessageDisplay(
    data,
    [first, second],
    [{ kind: "send", deliveryId: "accepted", selectedTool: "webSearch" }]
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
  const receipts: EveMessageDisplayReceipt[] = [
    { kind: "send", deliveryId: "accepted", selectedTool: null },
    { kind: "send", deliveryId: "other", selectedTool: null },
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
          type: "history.seeded",
          meta: { id: "restore", at: "2026-10-17T12:00:00Z" },
          data: { messages: data.messages },
        },
      ],
      receipts
    )
  ).toBe(data);
});
