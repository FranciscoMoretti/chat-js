import { defaultMessageReducer } from "eve/client";
import type { MessageStreamEvent } from "eve/client";
import { z } from "zod";

const checkpointIndex = z.number().int().min(0).max(2_147_483_647);
const nativeTurn = z.string().regex(/^turn_(?<turnIndex>0|[1-9][0-9]*)$/u);
const importedMessage = z
  .string()
  .regex(/^seed_message_(?<messageIndex>0|[1-9][0-9]{0,3})$/u);

export type EveCopyBoundary = {
  messageIndex: number;
  sourceKind: "turn" | "imported";
  sourceIndex: number;
};

/** Private provenance used only to snapshot application resources, never copied into native history. */
export const eveCopyBoundaries = (events: readonly MessageStreamEvent[]) => {
  const reducer = defaultMessageReducer();
  return (
    events
      // oxlint-disable-next-line unicorn/no-array-reduce -- Use EVE’s native event reducer and initial state for this projection.
      .reduce(reducer.reduce, reducer.initial())
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
