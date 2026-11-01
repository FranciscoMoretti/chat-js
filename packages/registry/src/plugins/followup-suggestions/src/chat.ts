import { inArray } from "drizzle-orm";
import type { ChatServerIntegration } from "@/chatjs/core/chat/contracts";
import { eveFollowup } from "./followup-schema";

export const followupChat = {
  onDeleteConversations: async (tx, { sessionIds }) => {
    if (sessionIds.length > 0) {
      await tx
        .delete(eveFollowup)
        .where(inArray(eveFollowup.sessionId, [...sessionIds]));
    }
  },
} satisfies ChatServerIntegration;
