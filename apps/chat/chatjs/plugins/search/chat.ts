import { inArray } from "drizzle-orm";
import type { ChatServerIntegration } from "@/chatjs/core/chat/contracts";
import { eveSearchText } from "./search-schema";

export const searchChat = {
  onDeleteConversations: async (tx, { conversationIds }) => {
    if (conversationIds.length === 0) {
      return;
    }
    await tx
      .delete(eveSearchText)
      .where(inArray(eveSearchText.conversationId, [...conversationIds]));
  },
} satisfies ChatServerIntegration;
