import { isGuestSession } from "@/lib/eve/session-identity";
import type { HookContext } from "eve/hooks";
import { defineHook } from "eve/hooks";

import { getEveConversationProject } from "./db/project-queries";
import { projectInstructions } from "./instructions-state";
import { resolveEveConversationScope } from "@/lib/eve/conversation-scope";

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
      projectInstructions.update(() => ({ content: null }));
      const scope = await resolveEveConversationScope(
        context.session.auth.initiator?.principalId,
        context.session.parent?.rootSessionId ?? context.session.id,
        AbortSignal.timeout(conversationScopeTimeoutMilliseconds),
        // Native lineage identifies the existing root binding. An inherited
        // reservation attribute never authorizes a child to claim that binding.
        context.session.parent
          ? undefined
          : context.session.auth.initiator?.attributes.chatjsReservationId
      );
      const project = await getEveConversationProject(
        scope.ownerId,
        scope.conversationId
      );
      projectInstructions.update(() => ({
        content: project?.instructions ?? null,
      }));
    },
  },
});
