import {
  captureEveDocumentCheckpoint,
  captureEveNamedDocumentCheckpoint,
} from "../../lib/db/eve-documents";
import type { HookContext } from "eve/hooks";
import { defineHook } from "eve/hooks";

import { getEveConversationProject } from "../../lib/db/eve-queries";
import { projectInstructions } from "../../lib/eve/project-instructions";
import { resolveEveConversationScope } from "../../lib/eve/conversation-scope";

const conversationScopeTimeoutMilliseconds = 10_000;

export default defineHook({
  checkpoint: async (
    checkpoint: Readonly<{ checkpointId: string; beforeTurnId: string }>,
    context: Readonly<{
      session: Readonly<Pick<HookContext["session"], "id" | "auth" | "parent">>;
    }>
  ) => {
    if (context.session.parent) {
      return;
    }
    const scope = await resolveEveConversationScope(
      context.session.auth.initiator?.principalId,
      context.session.id,
      AbortSignal.timeout(conversationScopeTimeoutMilliseconds),
      context.session.auth.initiator?.attributes.chatjsReservationId
    );
    await captureEveNamedDocumentCheckpoint(
      scope.ownerId,
      scope.conversationId,
      checkpoint.checkpointId,
      Number(checkpoint.beforeTurnId.slice("turn_".length))
    );
  },
  events: {
    "turn.started": async (
      event: { readonly data: { readonly sequence: number } },
      context: Readonly<{
        session: Readonly<
          Pick<HookContext["session"], "id" | "auth" | "parent">
        >;
      }>
    ) => {
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
      // Child turn indices and checkpoint IDs belong to the child's transcript.
      if (!context.session.parent) {
        await captureEveDocumentCheckpoint(
          scope.ownerId,
          scope.conversationId,
          event.data.sequence
        );
      }
    },
  },
});
