import { inArray } from "drizzle-orm";
import type { ChatServerIntegration } from "@/chatjs/core/chat/contracts";
import { eveSearchText } from "./search-schema";

const searchChat = {
  afterBranch: async ({ ownerId, branchId, sessionId }) => {
    const { backfillEveSearchConversation } = await import("./search-backfill");
    await backfillEveSearchConversation(ownerId, branchId, sessionId);
  },
  onDeleteConversations: async (tx, { branchIds }) => {
    if (branchIds.length === 0) {
      return;
    }
    await tx
      .delete(eveSearchText)
      .where(inArray(eveSearchText.branchId, [...branchIds]));
  },
} satisfies ChatServerIntegration;

export default searchChat;
