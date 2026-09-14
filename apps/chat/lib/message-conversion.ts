import type { Chat, DBMessage } from "@/lib/db/schema";
import type { UIChat } from "@/lib/types/ui-chat";

import type { ChatMessage } from "./ai/types";

// Helper functions for type conversion
export const dbChatToUIChat = (chat: Chat): UIChat => ({
  createdAt: chat.createdAt,
  id: chat.id,
  isPinned: chat.isPinned,
  projectId: chat.projectId ?? null,
  title: chat.title,
  updatedAt: chat.updatedAt,
  userId: chat.userId,
  visibility: chat.visibility,
});

export const chatMessageToDbMessage = (
  message: ChatMessage,
  chatId: string
): DBMessage => {
  const parentMessageId = message.metadata.parentMessageId || null;
  const { selectedModel } = message.metadata;

  // Ensure createdAt is a Date object
  let createdAt: Date;
  if (message.metadata?.createdAt) {
    createdAt =
      message.metadata.createdAt instanceof Date
        ? message.metadata.createdAt
        : new Date(message.metadata.createdAt);
  } else {
    createdAt = new Date();
  }

  // Parts are stored in Part table, not in Message.parts
  return {
    activeStreamId: message.metadata?.activeStreamId || null,
    annotations: [],
    attachments: [],
    canceledAt: null,
    chatId,
    createdAt,
    id: message.id,
    isPrimaryParallel: message.metadata?.isPrimaryParallel ?? null,
    lastContext: message.metadata?.usage || null,
    parallelGroupId: message.metadata?.parallelGroupId || null,
    parallelIndex: message.metadata?.parallelIndex ?? null,
    parentMessageId,
    role: message.role,
    selectedModel,
    selectedTool: message.metadata?.selectedTool || null,
  };
};
