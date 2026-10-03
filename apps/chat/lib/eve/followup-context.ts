import type { HookEvent } from "eve/hooks";

const MAX_CONTEXT_CHARACTERS = 12_000;
/* oxlint-disable typescript/consistent-type-definitions  --
 * import/no-named-export (#527): Preserve the named FollowupContext API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * typescript/consistent-type-definitions (#559): FollowupContext preserves its current alias/interface semantics; declaration merging and implicit index-signature assignability differ between those forms.
 */
export type FollowupContext = { user: string; assistant: string };
/* oxlint-enable typescript/consistent-type-definitions */

/* oxlint-disable jsdoc/require-param, jsdoc/require-returns, typescript/prefer-readonly-parameter-types  --
 * import/no-named-export (#527): Preserve the named followupContext API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * jsdoc/require-param (#534): followupContext's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): followupContext's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * oxc/no-optional-chaining (#542): followupContext handles optional event.data.message?.slice(-MAX_CONTEXT_CHARACTERS) without repeated reads; expanding guards requires preserving missing-value and evaluation semantics.
 * oxc/no-rest-spread-properties (#543): followupContext copies or separates ...current while preserving existing object ownership; mutating source objects is not equivalent.
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
