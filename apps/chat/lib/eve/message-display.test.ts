import { conversationOf } from "eve/client";
import type { SessionStreamEvent } from "eve/client";
import { expect, it } from "vitest";
import { projectEveMessageDisplay } from "./message-display";

const received = (
  position: number,
  deliveryId: string
): SessionStreamEvent => ({
  type: "delivery.consumed",
  scope: { turnId: `turn_${position}` },
  meta: {
    endOfLine: true,
    position: { line: position, index: 0 },
    at: "2026-10-17T12:00:00Z",
  },
  data: {
    deliveryId,
    turnId: `turn_${position}`,
    parts: [{ kind: "text", text: "Identical text" }],
  },
});

const project = (events: readonly SessionStreamEvent[]) =>
  conversationOf(
    events.flatMap((event, index): SessionStreamEvent[] => [
      {
        type: "delivery.admitted",
        data: { deliveryId: index === 0 ? "accepted" : "unknown" },
        meta: {
          at: "2026-10-17T12:00:00Z",
          position: { line: index * 3, index: 0 },
          endOfLine: true,
        },
      },
      {
        type: "turn.started",
        scope: event.scope,
        meta: {
          at: "2026-10-17T12:00:00Z",
          position: { line: index * 3 + 1, index: 0 },
          endOfLine: true,
        },
        data: {
          turnId: `turn_${index + 1}`,
          cause: { deliveryId: index === 0 ? "accepted" : "unknown" },
          follows: index === 0 ? null : `turn_${index}`,
        },
      },
      {
        ...event,
        meta: { ...event.meta, position: { line: index * 3 + 2, index: 0 } },
      },
    ])
  );

it("projects a known receipt by delivery identity, never by identical text", () => {
  const events = [received(1, "accepted"), received(2, "unknown")];
  const data = project(events);
  const projected = projectEveMessageDisplay(data, events, [
    { kind: "send", deliveryId: "accepted", selectedTool: "webSearch" },
  ]);
  expect(projected.messages[0]?.metadata?.custom).toEqual({
    chatjs: { selectedTool: "webSearch" },
  });
  expect(projected.messages[1]?.metadata?.custom).toBeUndefined();
  expect(data.messages[0]?.metadata?.custom).toBeUndefined();
  expect(projectEveMessageDisplay(data, events, [])).toBe(data);
});

it("requires one receipt and one consumption for the exact delivery", () => {
  const event = received(1, "accepted");
  const data = project([event]);
  const receipt = {
    kind: "send",
    deliveryId: "accepted",
    selectedTool: "webSearch",
  } as const;
  expect(projectEveMessageDisplay(data, [event], [receipt, receipt])).toBe(
    data
  );
  expect(projectEveMessageDisplay(data, [event, event], [receipt])).toBe(data);
  expect(projectEveMessageDisplay(data, [], [receipt])).toBe(data);
  expect(
    projectEveMessageDisplay(data, [received(2, "other")], [receipt])
  ).toBe(data);
});

it("does not decorate pending optimistic messages even when their id matches", () => {
  const event = received(1, "accepted");
  const confirmed = project([event]);
  const data = {
    ...confirmed,
    messages: confirmed.messages.map((message) => ({
      ...message,
      metadata: { ...message.metadata, optimistic: true as const },
    })),
  };
  const projected = projectEveMessageDisplay(
    data,
    [event],
    [{ kind: "send", deliveryId: "accepted", selectedTool: "webSearch" }]
  );
  expect(projected.messages[0]?.metadata?.custom).toBeUndefined();
});
