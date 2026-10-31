import { isAccountSession } from "@/lib/eve/session-identity";
import type { FollowupContext } from "./followup-context";
import type { HookContext } from "eve/hooks";
import { defineHook } from "eve/hooks";
import { defineState } from "eve/context";

import { followupContext } from "./followup-context";
import { generateEveFollowupSuggestions } from "./generate-suggestions";

const context = defineState<FollowupContext>(
  "chatjs.followups.context",
  () => ({ assistant: "", user: "" })
);

export default defineHook({
  events: {
    "content.completed": (event: Parameters<typeof followupContext>[1]) => {
      context.update((current: FollowupContext) =>
        followupContext(current, event)
      );
    },
    "delivery.consumed": (event: Parameters<typeof followupContext>[1]) => {
      context.update((current: FollowupContext) =>
        followupContext(current, event)
      );
    },
    "turn.settled": (
      event: {
        readonly data: { readonly turnId: string; readonly outcome: string };
      },
      hookContext: {
        readonly session: Readonly<
          Pick<HookContext["session"], "parent" | "id" | "auth">
        >;
      }
    ): ReturnType<typeof generateEveFollowupSuggestions> | undefined => {
      // Suggestions are actions for the user-facing branch, not a background task.
      if (
        event.data.outcome !== "completed" ||
        !isAccountSession(hookContext.session) ||
        hookContext.session.parent
      ) {
        return undefined;
      }
      return generateEveFollowupSuggestions(context.get(), {
        ownerId: hookContext.session.auth.initiator?.principalId ?? "",
        sessionId: hookContext.session.id,
        turnId: event.data.turnId,
        eventId: `turn:${event.data.turnId}:completed`,
      });
    },
    "turn.started": (event: Parameters<typeof followupContext>[1]) => {
      context.update((current: FollowupContext) =>
        followupContext(current, event)
      );
    },
  },
});
