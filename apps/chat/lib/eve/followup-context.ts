import type { HookEvent } from "eve/hooks";

const MAX_CONTEXT_CHARACTERS = 12_000;
/* oxlint-disable typescript/consistent-type-definitions --
 * typescript/consistent-type-definitions (#559): FollowupContext preserves its current alias/interface semantics; declaration merging and implicit index-signature assignability differ between those forms.
 */
export type FollowupContext = { user: string; assistant: string };
/* oxlint-enable typescript/consistent-type-definitions */

/* oxlint-disable jsdoc/require-param, jsdoc/require-returns, typescript/prefer-readonly-parameter-types --
 * jsdoc/require-param (#534): followupContext's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): followupContext's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * typescript/prefer-readonly-parameter-types (#565): followupContext accepts current: FollowupContext; event: HookEvent; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
/** Only the current exchange is retained; the native event log owns history. */
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
      ...current,
      assistant: event.data.message?.slice(-MAX_CONTEXT_CHARACTERS) ?? "",
    };
  }
  return current;
};
/* oxlint-enable jsdoc/require-param, jsdoc/require-returns, typescript/prefer-readonly-parameter-types */
