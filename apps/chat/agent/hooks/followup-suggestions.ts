/* oxlint-disable import/no-relative-parent-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../../lib/eve/followup-context"; "../../lib/eve/generate-followup-suggestions" dependency within this package instead of introducing an alias or barrel API.
 */
import { defineState } from "eve/context";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { defineHook } from "eve/hooks";
/* oxlint-enable sort-imports */

import { followupContext } from "../../lib/eve/followup-context";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { FollowupContext } from "../../lib/eve/followup-context";
/* oxlint-enable sort-imports */
import { generateEveFollowupSuggestions } from "../../lib/eve/generate-followup-suggestions";
/* oxlint-enable import/no-relative-parent-imports */

const context = defineState<FollowupContext>(
  "chatjs.followups.context",
  () => ({ assistant: "", user: "" })
);

/* oxlint-disable import/no-default-export, no-undefined, typescript/prefer-readonly-parameter-types, typescript/promise-function-async --
 * import/no-default-export (#526): Preserve the existing default export import contract; converting its consumers requires a public module API migration.
 * no-undefined (#519): default export uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * typescript/prefer-readonly-parameter-types (#565): default export accepts event; current; _event; hookContext; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): default export preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
export default defineHook({
  events: {
    "message.completed": (event) =>
      context.update((current) => followupContext(current, event)),
    "message.received": (event) =>
      context.update((current) => followupContext(current, event)),
    "turn.completed": (_event, hookContext) =>
      // Suggestions are actions for the user-facing branch, not a background task.
      hookContext.session.parent
        ? undefined
        : generateEveFollowupSuggestions(context.get()),
    "turn.started": (event) =>
      context.update((current) => followupContext(current, event)),
  },
});
/* oxlint-enable import/no-default-export, no-undefined, typescript/prefer-readonly-parameter-types, typescript/promise-function-async */
