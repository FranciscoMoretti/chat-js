import { conversationOf } from "eve/client";
import type { SessionStreamEvent } from "eve/client";
import { activeTurn, idle } from "eve/events";

export type WorkspaceTurnEvent = SessionStreamEvent;

export const ignoredDeliveryId = (
  event: WorkspaceTurnEvent
): string | undefined =>
  event.type === "delivery.settled" && event.data.outcome === "ignored"
    ? event.data.deliveryId
    : undefined;

/** Paused approvals and queued work retain the workspace reservation. */
export const hasSettledWorkspaceSession = (
  events: readonly WorkspaceTurnEvent[]
): boolean => {
  if (!events.some((event) => event.type === "session.started")) {
    return false;
  }
  const { view } = conversationOf(events);
  return (
    events.some((event) => event.type === "session.ended") ||
    (idle(view) && activeTurn(view) === undefined)
  );
};

export const hasSettledWorkspaceOperation = (
  operation: {
    readonly deliveryId: string | null;
  },
  events: readonly WorkspaceTurnEvent[]
): boolean => {
  const { deliveryId } = operation;
  if (deliveryId === null || !hasSettledWorkspaceSession(events)) {
    return false;
  }
  const consumedIndex = events.findIndex(
    (event) =>
      event.type === "delivery.consumed" && event.data.deliveryId === deliveryId
  );
  const consumed = events[consumedIndex];
  if (consumed?.type !== "delivery.consumed") {
    return events.some((event) => ignoredDeliveryId(event) === deliveryId);
  }
  return events
    .slice(consumedIndex + 1)
    .some(
      (event) =>
        event.type === "turn.settled" &&
        event.data.turnId === consumed.data.turnId
    );
};
