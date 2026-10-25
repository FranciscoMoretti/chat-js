import type { MessageStreamEvent } from "eve/client";

// Preserve native completion identity through replay.
type CompletionEvent =
  | {
      readonly type: "turn.completed";
      readonly data: { readonly turnId: string };
      readonly meta: { readonly id: string };
    }
  | {
      readonly type: "turn.started" | "turn.failed" | "turn.cancelled";
      readonly data: { readonly turnId: string };
    }
  | {
      readonly type: Exclude<
        MessageStreamEvent["type"],
        "turn.completed" | "turn.started" | "turn.failed" | "turn.cancelled"
      >;
    };

export const followupCompletion = (
  events: readonly CompletionEvent[],
  turnId: string | undefined
): string | undefined => {
  let id: string | undefined;
  for (const event of events) {
    if (event.type === "turn.completed" && event.data.turnId === turnId) {
      ({ id } = event.meta);
    } else if (
      (event.type === "turn.started" ||
        event.type === "turn.failed" ||
        event.type === "turn.cancelled") &&
      event.data.turnId === turnId
    ) {
      id = undefined;
    }
  }
  return id;
};
