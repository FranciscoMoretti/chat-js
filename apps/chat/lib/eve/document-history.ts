import type { MessageStreamEvent } from "eve/client";

const nativeTurnId = /^turn_\d+$/u;

/* oxlint-disable jsdoc/require-param, jsdoc/require-returns, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types --
 * jsdoc/require-param (#534): documentHistoryTurns's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): documentHistoryTurns's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * typescript/explicit-function-return-type (#560): Keep documentHistoryTurns's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep documentHistoryTurns's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): documentHistoryTurns accepts events: readonly MessageStreamEvent[]; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
/** Include inherited turns: restored history does not replay turn.started. */
export const documentHistoryTurns = (events: readonly MessageStreamEvent[]) => {
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
/* oxlint-enable jsdoc/require-param, jsdoc/require-returns, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types */
