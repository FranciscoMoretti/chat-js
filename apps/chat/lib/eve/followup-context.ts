import type { HookEvent } from "eve/hooks";

const MAX_CONTEXT_CHARACTERS = 12_000;
export type FollowupContext = { user: string; assistant: string };

/** Only the current exchange is retained; the native event log owns history. */
export function followupContext(
  current: FollowupContext,
  event: HookEvent
): FollowupContext {
  if (event.type === "turn.started") {
    return { user: "", assistant: "" };
  }
  if (event.type === "message.received") {
    return {
      user: event.data.message.slice(-MAX_CONTEXT_CHARACTERS),
      assistant: "",
    };
  }
  if (
    event.type === "message.completed" &&
    event.data.finishReason !== "tool-calls"
  ) {
    return {
      ...current,
      assistant: event.data.message?.slice(-MAX_CONTEXT_CHARACTERS) ?? "",
    };
  }
  return current;
}
