import { defaultMessageReducer, type MessageStreamEvent } from "eve/client";
import { z } from "zod";

const checkpointIndex = z.number().int().min(0).max(2_147_483_647);
const nativeTurn = z.string().regex(/^turn_(0|[1-9][0-9]*)$/);
const importedMessage = z.string().regex(/^seed_message_(0|[1-9][0-9]{0,3})$/);

export type EveCopyBoundary = {
  messageIndex: number;
  sourceKind: "turn" | "imported";
  sourceIndex: number;
};

/** Private provenance used only to snapshot application resources, never copied into native history. */
export function eveCopyBoundaries(events: readonly MessageStreamEvent[]) {
  const reducer = defaultMessageReducer();
  return events
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
            sourceKind: "turn",
            sourceIndex: checkpointIndex.parse(Number(turn.data.slice(5))),
          },
        ];
      }
      const imported = importedMessage.safeParse(message.id);
      if (imported.success) {
        return [
          {
            messageIndex,
            sourceKind: "imported",
            sourceIndex: Number(imported.data.slice(13)),
          },
        ];
      }
      throw new Error("Conversation document boundary is unavailable.");
    });
}
