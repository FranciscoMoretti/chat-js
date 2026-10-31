import type { HookEvent } from "eve/hooks";

const MAX_CONTEXT_CHARACTERS = 12_000;
export interface FollowupContext {
  readonly user: string;
  readonly assistant: string;
}
export const followupContext = (
  current: FollowupContext,
  event: HookEvent
): FollowupContext => {
  if (event.type === "turn.started") {
    return { assistant: "", user: "" };
  }
  if (event.type === "delivery.consumed") {
    return {
      assistant: "",
      user: event.data.parts
        .flatMap((part) => (part.kind === "text" ? [part.text] : []))
        .join("\n")
        .slice(-MAX_CONTEXT_CHARACTERS),
    };
  }
  if (
    event.type === "content.completed" &&
    event.data.kind === "text" &&
    event.data.phase === "reply" &&
    typeof event.data.value === "string"
  ) {
    return {
      ...current,
      assistant: event.data.value.slice(-MAX_CONTEXT_CHARACTERS),
    };
  }
  return current;
};
