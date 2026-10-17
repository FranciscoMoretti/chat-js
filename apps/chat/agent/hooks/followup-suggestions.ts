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
      event: {
        readonly data: { readonly turnId: string };
        readonly meta: { readonly id: string };
      },
      hookContext: {
        readonly session: Readonly<
          Pick<HookContext["session"], "parent" | "id" | "auth">
        >;
      }
    ): ReturnType<typeof generateEveFollowupSuggestions> | undefined => {
      // Suggestions are actions for the user-facing branch, not a background task.
      if (hookContext.session.parent) {
        return undefined;
      }
      return generateEveFollowupSuggestions(context.get(), {
        ownerId: hookContext.session.auth.initiator?.principalId ?? "",
        sessionId: hookContext.session.id,
        turnId: event.data.turnId,
        eventId: event.meta.id,
      });
    },
    "turn.started": (event: Parameters<typeof followupContext>[1]) => {
      context.update((current: FollowupContext) =>
        followupContext(current, event)
      );
    },
  },
});
