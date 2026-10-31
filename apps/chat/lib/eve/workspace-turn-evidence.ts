import { conversationOf } from "eve/client";
import type { SessionStreamEvent } from "eve/client";
import { activeTurn, idle } from "eve/events";

export type WorkspaceTurnEvent = SessionStreamEvent;

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
    readonly kind: "create" | "copy" | "send";
    readonly deliveryId: string | null;
    readonly seeded: boolean;
  },
  events: readonly WorkspaceTurnEvent[]
): boolean => {
  if (!hasSettledWorkspaceSession(events)) {
    return false;
  }
  if (operation.kind === "copy" || operation.seeded) {
    return true;
  }
  const consumed = events.find(
    (event) =>
      event.type === "delivery.consumed" &&
      event.data.deliveryId === operation.deliveryId
  );
  return (
    consumed?.type === "delivery.consumed" &&
    events.some(
      (event) =>
        event.type === "turn.settled" &&
        event.data.turnId === consumed.data.turnId
    )
  );
};
