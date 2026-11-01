import type { ChatServerIntegration } from "@/chatjs/core/chat/contracts";

export const aiTitlesChat = {
  afterCreate: async (context) => {
    const { persistGeneratedEveConversationTitle } =
      await import("./generate-title");
    await persistGeneratedEveConversationTitle(context);
  },
} satisfies ChatServerIntegration;
