import type { ModelId } from "@/lib/ai/app-models";
import type { Chat, DBMessage } from "@/lib/db/schema";
import type { UIChat } from "@/lib/types/ui-chat";

import { isSelectedModelValue } from "./ai/types";
import type { ChatMessage, UiToolName } from "./ai/types";

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

const _dbMessageToChatMessage = (message: DBMessage): ChatMessage =>
  // Note: This function should not be used directly for messages with parts
  // Use getAllMessagesByChatId which reconstructs parts from Part table
  // Parts are now stored in Part table, not in Message.parts
  // Parts are stored in Part table - use getAllMessagesByChatId instead.
  ({
    id: message.id,
    metadata: {
      activeStreamId: message.activeStreamId,
      createdAt: message.createdAt,
      isPrimaryParallel: message.isPrimaryParallel,
      parallelGroupId: message.parallelGroupId,
      parallelIndex: message.parallelIndex,
      parentMessageId: message.parentMessageId,
      selectedModel: isSelectedModelValue(message.selectedModel)
        ? message.selectedModel
        : ("" as ModelId),
      selectedTool: (message.selectedTool as UiToolName | null) || undefined,
      usage: message.lastContext as ChatMessage["metadata"]["usage"],
    },
    parts: [],
    role: message.role as ChatMessage["role"],
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
