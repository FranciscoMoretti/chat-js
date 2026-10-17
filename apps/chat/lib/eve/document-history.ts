import type { MessageStreamEvent } from "eve/client";

type ReadonlyHistory<Value> = Value extends readonly (infer Item)[]
  ? readonly ReadonlyHistory<Item>[]
  : Value extends object
    ? { readonly [Key in keyof Value]: ReadonlyHistory<Value[Key]> }
    : Value;
type DocumentHistoryEvent = ReadonlyHistory<MessageStreamEvent>;

const nativeTurnId = /^turn_\d+$/u;

/**
 * Include inherited turns: restored history does not replay turn.started.
 * @param {readonly MessageStreamEvent[]} events Native history events, including restored prefixes and their before-turn boundary.
 * @returns {number[]} Unique native turn sequences in first-seen order; invalid inherited turn IDs fail validation.
 */
export const documentHistoryTurns = (
  events: readonly DocumentHistoryEvent[]
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
  const pending = events.toReversed();
  let visited = 0;
  while (pending.length > 0) {
    visited += 1;
    if (visited > 10_000) {
      throw new Error("Native document history exceeds the traversal limit.");
    }
    const event = pending.pop();
    if (event === undefined) {
      break;
    }
    if (event.type === "turn.started") {
      turns.add(event.data.sequence);
    } else if (event.type === "history.restored") {
      addTurn(event.data.beforeTurnId);
      pending.push(...event.data.events.toReversed());
    } else if (
      "data" in event &&
      event.data !== undefined &&
      "turnId" in event.data
    ) {
      addTurn(event.data.turnId);
    }
  }
  return [...turns];
};
