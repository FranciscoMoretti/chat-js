import { isGuestSession } from "../../lib/eve/session-identity";
import type { HookContext } from "eve/hooks";
import { defineHook } from "eve/hooks";

import { resolveEveConversationScope } from "../../lib/eve/conversation-scope";

const conversationScopeTimeoutMilliseconds = 10_000;

export default defineHook({
  events: {
    "turn.started": async (
      _event: { readonly data: { readonly sequence: number } },
      context: Readonly<{
        session: Readonly<
          Pick<HookContext["session"], "id" | "auth" | "parent">
        >;
      }>
    ) => {
      if (isGuestSession(context.session)) {
        return;
      }
      await resolveEveConversationScope(
        context.session.auth.initiator?.principalId,
        context.session.parent?.rootSessionId ?? context.session.id,
        AbortSignal.timeout(conversationScopeTimeoutMilliseconds),
        // Native lineage identifies the existing root binding. An inherited
        // reservation attribute never authorizes a child to claim that binding.
        context.session.parent
          ? undefined
          : context.session.auth.initiator?.attributes.chatjsReservationId
      );
    },
  },
});
