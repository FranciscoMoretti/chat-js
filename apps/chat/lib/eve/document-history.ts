import type { MessageStreamEvent } from "eve/client";

const nativeTurnId = /^turn_\d+$/u;

/* oxlint-disable typescript/prefer-readonly-parameter-types --
 * typescript/prefer-readonly-parameter-types (#565): documentHistoryTurns accepts events: readonly MessageStreamEvent[]; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
/**
 * Include inherited turns: restored history does not replay turn.started.
 * @param events Native history events, including restored prefixes and their before-turn boundary.
 * @returns Unique native turn sequences in first-seen order; invalid inherited turn IDs fail validation.
 */
export const documentHistoryTurns = (
  events: readonly MessageStreamEvent[]
): number[] => {
  const turns = new Set<number>();
  const addTurn = (turnId: string): void => {
    if (!nativeTurnId.test(turnId)) {
      throw new Error("Native document history has an invalid turn.");
    }
    const turn = Number(turnId.slice("turn_".length));
    if (!Number.isSafeInteger(turn)) {
      throw new TypeError("Native document history has an invalid turn.");
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
};
/* oxlint-enable typescript/prefer-readonly-parameter-types */
