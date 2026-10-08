/* oxlint-disable import/no-relative-parent-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../../lib/eve/followup-context"; "../../lib/eve/generate-followup-suggestions" dependency within this package instead of introducing an alias or barrel API.
 */
import { defineState } from "eve/context";
// oxlint-disable-next-line sort-imports -- Oxfmt groups this type reader import by module; sort-imports requires a different binding-name or syntax order.
import type { HookContext } from "eve/hooks";
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

/* oxlint-disable import/no-default-export -- import/no-default-export (#526): Preserve the existing default export import contract; current; _event; hookContext; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration. */

export default defineHook({
  events: {
    // oxlint-disable-next-line no-magic-numbers -- The numeric index selects the original callback parameter in this type-only lookup; it does not add a runtime constant.
    "message.completed": (event: Parameters<typeof followupContext>[1]) =>
      context.update((current: FollowupContext) =>
        followupContext(current, event)
      ),
    // oxlint-disable-next-line no-magic-numbers -- The numeric index selects the original callback parameter in this type-only lookup; it does not add a runtime constant.
    "message.received": (event: Parameters<typeof followupContext>[1]) =>
      context.update((current: FollowupContext) =>
        followupContext(current, event)
      ),
    "turn.completed": (
      _event: unknown,
      hookContext: {
        readonly session: Readonly<Pick<HookContext["session"], "parent">>;
      }
    ): ReturnType<typeof generateEveFollowupSuggestions> | undefined => {
      // Suggestions are actions for the user-facing branch, not a background task.
      if (hookContext.session.parent) {
        // oxlint-disable-next-line no-undefined -- A child turn produces no followup action; preserve the hook's synchronous undefined result and the parent-turn branch's original Promise identity.
        return undefined;
      }
      return generateEveFollowupSuggestions(context.get());
    },
    // oxlint-disable-next-line no-magic-numbers -- The numeric index selects the original callback parameter in this type-only lookup; it does not add a runtime constant.
    "turn.started": (event: Parameters<typeof followupContext>[1]) =>
      context.update((current: FollowupContext) =>
        followupContext(current, event)
      ),
  },
});
/* oxlint-enable import/no-default-export */
