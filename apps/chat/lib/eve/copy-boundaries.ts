import type { MessageStreamEvent } from "eve/client";
import { defaultMessageReducer } from "eve/client";
import { z } from "zod";

const MIN_CHECKPOINT_INDEX = 0;
const MAX_CHECKPOINT_INDEX = 2_147_483_647;
const NATIVE_TURN_PREFIX = "turn_";
const IMPORTED_MESSAGE_PREFIX = "seed_message_";
const checkpointIndex = z
  .number()
  .int()
  .min(MIN_CHECKPOINT_INDEX)
  .max(MAX_CHECKPOINT_INDEX);

const nativeTurn = z.string().regex(/^turn_(?<turnIndex>0|[1-9][0-9]*)$/u);
const importedMessage = z
  .string()
  .regex(/^seed_message_(?<messageIndex>0|[1-9][0-9]{0,3})$/u);

export interface EveCopyBoundary {
  readonly messageIndex: number;
  readonly sourceKind: "turn" | "imported";
  readonly sourceIndex: number;
}

/**
 * Private provenance used only to snapshot application resources, never copied into native history.
 * @param {readonly MessageStreamEvent[]} events Native EVE events reduced in their original order to locate user-message checkpoints.
 * @returns {EveCopyBoundary[]} One source turn or imported-message boundary for each user message; malformed provenance throws.
 */
export const eveCopyBoundaries = (
  events: readonly MessageStreamEvent[]
): EveCopyBoundary[] => {
  const reducer = defaultMessageReducer();
  const reduceEvent = reducer.reduce.bind(reducer);
  let state = reducer.initial();
  for (const event of events) {
    state = reduceEvent(state, event);
  }
  return state.messages.flatMap<EveCopyBoundary>(
    (
      message: {
        readonly id: string;
        readonly role: string;
        readonly metadata?: { readonly turnId?: string };
      },
      messageIndex
    ) => {
      if (message.role !== "user") {
        return [];
      }
      const turn = nativeTurn.safeParse(message.metadata?.turnId);
      if (turn.success) {
        return [
          {
            messageIndex,
            sourceIndex: checkpointIndex.parse(
              Number(turn.data.slice(NATIVE_TURN_PREFIX.length))
            ),
            sourceKind: "turn",
          },
        ];
      }
      const imported = importedMessage.safeParse(message.id);
      if (imported.success) {
        return [
          {
            messageIndex,
            sourceIndex: Number(
              imported.data.slice(IMPORTED_MESSAGE_PREFIX.length)
            ),
            sourceKind: "imported",
          },
        ];
      }
      throw new Error("Conversation document boundary is unavailable.");
    }
  );
};
