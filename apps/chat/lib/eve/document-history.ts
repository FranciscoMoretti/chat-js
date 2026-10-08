import type { MessageStreamEvent } from "eve/client";

type InheritedTurnData<Data> = {
  readonly [Key in keyof Data]: Key extends "turnId" ? Data[Key] : unknown;
};
type DocumentHistoryEvent =
  | {
      readonly type: "turn.started";
      readonly data: Readonly<
        Extract<MessageStreamEvent, { type: "turn.started" }>["data"]
      >;
    }
  | {
      readonly type: "history.restored";
      readonly data: Readonly<
        Omit<
          Extract<MessageStreamEvent, { type: "history.restored" }>["data"],
          "events"
        >
      > & {
        readonly events: readonly {
          readonly data: InheritedTurnData<
            Extract<MessageStreamEvent, { data: unknown }>["data"]
          >;
        }[];
      };
    }
  | {
      readonly type: Exclude<
        MessageStreamEvent["type"],
        "turn.started" | "history.restored"
      >;
    };

const nativeTurnId = /^turn_\d+$/u;

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (documentHistoryTurns); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */

/**
 * Include inherited turns: restored history does not replay turn.started.
 * @param {readonly MessageStreamEvent[]} events Native history events, including restored prefixes and their before-turn boundary.
 * @returns {number[]} Unique native turn sequences in first-seen order; invalid inherited turn IDs fail validation.
 */
export const documentHistoryTurns =
  /* oxlint-disable typescript/no-unnecessary-type-parameters -- The generic readonly reader accepts full SDK event/message literals without rejecting their additional fields. */
  <Event extends DocumentHistoryEvent>(events: readonly Event[]): number[] => {
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
/* oxlint-enable typescript/no-unnecessary-type-parameters */
/* oxlint-enable import/prefer-default-export, import/no-named-export */
