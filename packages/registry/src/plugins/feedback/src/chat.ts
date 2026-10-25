import { inArray } from "drizzle-orm";
import type { ChatServerIntegration } from "@/lib/chat-plugin-contracts";
import { eveVote } from "./feedback-schema";

export const feedbackChat = {
  onDeleteConversations: async (tx, { conversationIds }) => {
    if (conversationIds.length > 0) {
      await tx
        .delete(eveVote)
        .where(inArray(eveVote.conversationId, [...conversationIds]));
    }
  },
} satisfies ChatServerIntegration;
