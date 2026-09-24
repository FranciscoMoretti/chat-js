import { defineHook } from "eve/hooks";

import {
  captureEveDocumentCheckpoint,
  captureEveNamedDocumentCheckpoint,
} from "../../lib/db/eve-documents";
import { getEveConversationProject } from "../../lib/db/eve-queries";
import { resolveEveConversationScope } from "../../lib/eve/conversation-scope";
import { projectInstructions } from "../../lib/eve/project-instructions";

export default defineHook({
  events: {
    "session.waiting": async (event, context) => {
      if (context.session.parent || !event.data.checkpoint) {
        return;
      }
      const scope = await resolveEveConversationScope(
        context.session.auth.initiator?.principalId,
        context.session.id,
        AbortSignal.timeout(10_000),
        context.session.auth.initiator?.attributes.chatjsReservationId
      );
      await captureEveNamedDocumentCheckpoint(
        scope.ownerId,
        scope.conversationId,
        event.data.checkpoint.checkpointId,
        Number(event.data.checkpoint.beforeTurnId.slice("turn_".length))
      );
    },
    "turn.started": async (event, context) => {
      projectInstructions.update(() => ({ content: null }));
      const scope = await resolveEveConversationScope(
        context.session.auth.initiator?.principalId,
        context.session.parent?.rootSessionId ?? context.session.id,
        AbortSignal.timeout(10_000),
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
