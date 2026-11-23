import type { ChatServerIntegration } from "@/chatjs/core/chat/contracts";

const aiTitlesChat = {
  afterCreate: async (context) => {
    const { persistGeneratedEveConversationTitle } =
      await import("./generate-title");
    await persistGeneratedEveConversationTitle(context);
  },
} satisfies ChatServerIntegration;

export default aiTitlesChat;
