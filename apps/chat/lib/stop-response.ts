import type { ChatMessage } from "@/lib/ai/types";

export const isPendingResponseStream = (
  activeStreamId: string | null | undefined
): boolean => activeStreamId?.startsWith("pending:") ?? false;

export const clearResponseActiveStream = (
  messages: ChatMessage[],
  messageId: string
) =>
  messages.map((message) =>
    message.id === messageId &&
    message.metadata.activeStreamId !== null &&
    !isPendingResponseStream(message.metadata.activeStreamId)
      ? {
          ...message,
          metadata: {
            ...message.metadata,
            activeStreamId: null,
          },
        }
      : message
  );
