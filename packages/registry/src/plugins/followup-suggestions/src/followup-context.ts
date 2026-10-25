import type { HookEvent } from "eve/hooks";

/** SDK fields this reader does not inspect remain optional and opaque. */
type IgnoredSdkFields<Value> = Value extends object
  ? { readonly [Key in keyof Value]?: unknown }
  : unknown;

type FollowupEvent = IgnoredSdkFields<HookEvent> &
  (
    | { readonly type: "turn.started" }
    | {
        readonly type: "message.received";
        readonly data: Readonly<
          Pick<
            Extract<HookEvent, { type: "message.received" }>["data"],
            "message"
          >
        > &
          IgnoredSdkFields<
            Extract<HookEvent, { type: "message.received" }>["data"]
          >;
      }
    | {
        readonly type: "message.completed";
        readonly data: Readonly<
          Pick<
            Extract<HookEvent, { type: "message.completed" }>["data"],
            "message" | "finishReason"
          >
        > &
          IgnoredSdkFields<
            Extract<HookEvent, { type: "message.completed" }>["data"]
          >;
      }
    | {
        readonly type: Exclude<
          HookEvent["type"],
          "turn.started" | "message.received" | "message.completed"
        >;
      }
  );

const MAX_CONTEXT_CHARACTERS = 12_000;
export interface FollowupContext {
  readonly user: string;
  readonly assistant: string;
}

/**
 * Retain only the current exchange; the native event log owns history.
 * @param {Readonly<FollowupContext>} current Previously retained user and assistant text.
 * @param {HookEvent} event Native turn or message event used to reset or replace the exchange.
 * @returns {FollowupContext} Current exchange with messages bounded to the context limit, or the original object for unrelated events.
 */
export const followupContext = (
  current: FollowupContext,

  event: FollowupEvent
): FollowupContext => {
  if (event.type === "turn.started") {
    return { assistant: "", user: "" };
  }
  if (event.type === "message.received") {
    return {
      assistant: "",
      user: event.data.message.slice(-MAX_CONTEXT_CHARACTERS),
    };
  }
  if (
    event.type === "message.completed" &&
    event.data.finishReason !== "tool-calls"
  ) {
    return {
      ...current,
      assistant: (event.data.message ?? "").slice(-MAX_CONTEXT_CHARACTERS),
    };
  }
  return current;
};
