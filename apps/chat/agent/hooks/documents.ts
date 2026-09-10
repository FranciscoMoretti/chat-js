import { defineHook } from "eve/hooks";
import { captureEveDocumentCheckpoint } from "../../lib/db/eve-documents";
import { resolveEveDocumentConversation } from "../../lib/eve/document-session";

export default defineHook({
  events: {
    "turn.started": async (event, context) => {
      const scope = await resolveEveDocumentConversation(
        context.session.auth.initiator?.principalId,
        context.session.id,
        AbortSignal.timeout(10_000)
      );
      await captureEveDocumentCheckpoint(
        scope.ownerId,
        scope.conversationId,
        event.data.sequence
      );
    },
  },
});
