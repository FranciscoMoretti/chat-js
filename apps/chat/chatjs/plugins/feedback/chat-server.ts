import { inArray } from "drizzle-orm";
import type { ChatServerIntegration } from "@/chatjs/core/chat/contracts";
import { eveVote } from "./feedback-schema";

const feedbackChat = {
  onDeleteConversations: async (tx, { branchIds }) => {
    if (branchIds.length > 0) {
      await tx.delete(eveVote).where(inArray(eveVote.branchId, [...branchIds]));
    }
  },
} satisfies ChatServerIntegration;

export default feedbackChat;
