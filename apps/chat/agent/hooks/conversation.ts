import { defineHook } from "eve/hooks";
import { captureEveDocumentCheckpoint } from "../../lib/db/eve-documents";
import { getEveConversationProject } from "../../lib/db/eve-queries";
import { resolveEveConversationScope } from "../../lib/eve/conversation-scope";
import { projectInstructions } from "../../lib/eve/project-instructions";

export default defineHook({
  events: {
    "turn.started": async (event, context) => {
      projectInstructions.update(() => ({ content: null }));
      const scope = await resolveEveConversationScope(
        context.session.auth.initiator?.principalId,
        context.session.id,
        AbortSignal.timeout(10_000)
      );
      const project = await getEveConversationProject(
        scope.ownerId,
        scope.conversationId
      );
      projectInstructions.update(() => ({
        content: project?.instructions ?? null,
      }));
      await captureEveDocumentCheckpoint(
        scope.ownerId,
        scope.conversationId,
        event.data.sequence
      );
    },
  },
});
