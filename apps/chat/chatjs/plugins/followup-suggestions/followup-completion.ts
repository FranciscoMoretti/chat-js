import type { SessionStreamEvent } from "eve/client";

export const followupCompletion = (
  events: readonly SessionStreamEvent[],
  turnId: string | undefined
): string | undefined => {
  const last = events.findLast(
    (event) =>
      (event.type === "turn.started" || event.type === "turn.settled") &&
      event.data.turnId === turnId
  );
  return last?.type === "turn.settled" && last.data.outcome === "completed"
    ? `turn:${last.data.turnId}:completed`
    : undefined;
};
