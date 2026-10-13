import type { FollowupContext } from "../../lib/eve/followup-context";
import type { HookContext } from "eve/hooks";
import { defineHook } from "eve/hooks";
import { defineState } from "eve/context";

import { followupContext } from "../../lib/eve/followup-context";
import { generateEveFollowupSuggestions } from "../../lib/eve/generate-followup-suggestions";

const context = defineState<FollowupContext>(
  "chatjs.followups.context",
  () => ({ assistant: "", user: "" })
);

export default defineHook({
  events: {
    "message.completed": (event: Parameters<typeof followupContext>[1]) => {
      context.update((current: FollowupContext) =>
        followupContext(current, event)
      );
    },
    "message.received": (event: Parameters<typeof followupContext>[1]) => {
      context.update((current: FollowupContext) =>
        followupContext(current, event)
      );
    },
    "turn.completed": (
      _event: unknown,
      hookContext: {
        readonly session: Readonly<Pick<HookContext["session"], "parent">>;
      }
    ): ReturnType<typeof generateEveFollowupSuggestions> | undefined => {
      // Suggestions are actions for the user-facing branch, not a background task.
      if (hookContext.session.parent) {
        return undefined;
      }
      return generateEveFollowupSuggestions(context.get());
    },
    "turn.started": (event: Parameters<typeof followupContext>[1]) => {
      context.update((current: FollowupContext) =>
        followupContext(current, event)
      );
    },
  },
});
