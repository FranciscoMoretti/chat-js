import type { MessageStreamEvent } from "eve/client";

const nativeTurnId = /^turn_\d+$/;

/** Include inherited turns: restored history does not replay turn.started. */
export function documentHistoryTurns(events: readonly MessageStreamEvent[]) {
  const turns = new Set<number>();
  const addTurn = (turnId: string) => {
    if (!nativeTurnId.test(turnId)) {
      throw new Error("Native document history has an invalid turn.");
    }
    const turn = Number(turnId.slice("turn_".length));
    if (!Number.isSafeInteger(turn)) {
      throw new Error("Native document history has an invalid turn.");
    }
    turns.add(turn);
  };
  for (const event of events) {
    if (event.type === "turn.started") {
      turns.add(event.data.sequence);
    } else if (event.type === "history.restored") {
      addTurn(event.data.beforeTurnId);
      for (const inherited of event.data.events) {
        if ("turnId" in inherited.data) {
          addTurn(inherited.data.turnId);
        }
      }
    }
  }
  return [...turns];
}
