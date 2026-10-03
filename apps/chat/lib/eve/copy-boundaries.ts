import { defaultMessageReducer } from "eve/client";
import type { MessageStreamEvent } from "eve/client";
import { z } from "zod";

/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): checkpointIndex uses 0, 2_147_483_647 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 */
const checkpointIndex = z.number().int().min(0).max(2_147_483_647);
/* oxlint-enable no-magic-numbers */
const nativeTurn = z.string().regex(/^turn_(?<turnIndex>0|[1-9][0-9]*)$/u);
const importedMessage = z
  .string()
  .regex(/^seed_message_(?<messageIndex>0|[1-9][0-9]{0,3})$/u);

/* oxlint-disable typescript/consistent-type-definitions --
 * typescript/consistent-type-definitions (#559): EveCopyBoundary preserves its current alias/interface semantics; declaration merging and implicit index-signature assignability differ between those forms.
 */
export type EveCopyBoundary = {
  messageIndex: number;
  sourceKind: "turn" | "imported";
  sourceIndex: number;
};
/* oxlint-enable typescript/consistent-type-definitions */

/* oxlint-disable jsdoc/require-param, jsdoc/require-returns, no-magic-numbers, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types --
 * jsdoc/require-param (#534): eveCopyBoundaries's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): eveCopyBoundaries's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * no-magic-numbers (#517): eveCopyBoundaries uses 5, 13 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * typescript/explicit-function-return-type (#560): Keep eveCopyBoundaries's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep eveCopyBoundaries's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): eveCopyBoundaries accepts events: readonly MessageStreamEvent[]; state; event; message; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
/** Private provenance used only to snapshot application resources, never copied into native history. */
export const eveCopyBoundaries = (events: readonly MessageStreamEvent[]) => {
  const reducer = defaultMessageReducer();
  const reduceEvent = reducer.reduce.bind(reducer);
  return (
    events
      // oxlint-disable-next-line unicorn/no-array-reduce -- Use EVE’s native event reducer and initial state for this projection.
      .reduce((state, event) => reduceEvent(state, event), reducer.initial())
      .messages.flatMap<EveCopyBoundary>((message, messageIndex) => {
        if (message.role !== "user") {
          return [];
        }
        const turn = nativeTurn.safeParse(message.metadata?.turnId);
        if (turn.success) {
          return [
            {
              messageIndex,
              sourceIndex: checkpointIndex.parse(Number(turn.data.slice(5))),
              sourceKind: "turn",
            },
          ];
        }
        const imported = importedMessage.safeParse(message.id);
        if (imported.success) {
          return [
            {
              messageIndex,
              sourceIndex: Number(imported.data.slice(13)),
              sourceKind: "imported",
            },
          ];
        }
        throw new Error("Conversation document boundary is unavailable.");
      })
  );
};
/* oxlint-enable jsdoc/require-param, jsdoc/require-returns, no-magic-numbers, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types */
