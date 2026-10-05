import type { HookEvent } from "eve/hooks";

const MAX_CONTEXT_CHARACTERS = 12_000;
/* oxlint-disable import/no-named-export -- Keep the named type bindings (FollowupContext); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export interface FollowupContext {
  user: string;
  assistant: string;
}
/* oxlint-enable import/no-named-export */

/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (followupContext); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable typescript/prefer-readonly-parameter-types --
 * typescript/prefer-readonly-parameter-types (#565): followupContext accepts current: FollowupContext; event: HookEvent; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
/**
 * Retain only the current exchange; the native event log owns history.
 * @param {FollowupContext} current Previously retained user and assistant text.
 * @param {HookEvent} event Native turn or message event used to reset or replace the exchange.
 * @returns {FollowupContext} Current exchange with messages bounded to the context limit, or the original object for unrelated events.
 */
export const followupContext = (
  current: FollowupContext,
  event: HookEvent
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
      // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing current own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
      ...current,
      assistant: event.data.message?.slice(-MAX_CONTEXT_CHARACTERS) ?? "",
    };
  }
  return current;
};
/* oxlint-enable import/no-named-export */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
