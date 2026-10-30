import { chat } from "@/integrations/chat";
import { eveConversationTitleFallback } from "./eve/conversation-title";
import { createModuleLogger } from "./logger";
import type { ChatCreatedContext } from "./chat-plugin-contracts";

const log = createModuleLogger("chat.after-create");

export const runChatAfterCreate = async (
  context: ChatCreatedContext
): Promise<void> => {
  try {
    await chat.afterCreate(context);
  } catch (error) {
    log.warn(
      { errorName: error instanceof Error ? error.name : typeof error },
      "Chat afterCreate failed"
    );
  }
  try {
    const { settleEveRootFallbackTitle } = await import("./db/eve-title");
    await settleEveRootFallbackTitle(
      context.ownerId,
      context.conversationId,
      eveConversationTitleFallback(context.message)
    );
  } catch (error) {
    log.warn(
      { errorName: error instanceof Error ? error.name : typeof error },
      "Chat fallback title settlement failed"
    );
  }
};
