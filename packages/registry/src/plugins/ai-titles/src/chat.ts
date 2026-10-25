import type { ChatServerIntegration } from "@/lib/chat-plugin-contracts";

export const aiTitlesChat = {
  afterCreate: async (context) => {
    const { persistGeneratedEveConversationTitle } =
      await import("./generate-title");
    await persistGeneratedEveConversationTitle(context);
  },
} satisfies ChatServerIntegration;
