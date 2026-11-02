import type { SessionStreamEvent } from "eve/client";

export const followupEventId = (sessionId: string, turnId: string): string =>
  JSON.stringify([sessionId, turnId, "completed"]);

export const followupCompletion = (
  events: readonly SessionStreamEvent[],
  turnId: string | undefined,
  sessionId: string
): string | undefined => {
  const last = events.findLast(
    (event) =>
      (event.type === "turn.started" || event.type === "turn.settled") &&
      event.data.turnId === turnId
  );
  return last?.type === "turn.settled" && last.data.outcome === "completed"
    ? followupEventId(sessionId, last.data.turnId)
    : undefined;
};
