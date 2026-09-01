import type { ChatMessage } from "@/lib/ai/types";

export function clearResponseActiveStream(
  messages: ChatMessage[],
  messageId: string
) {
  return messages.map((message) =>
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
}

export function isPendingResponseStream(
  activeStreamId: string | null | undefined
) {
  return activeStreamId?.startsWith("pending:") ?? false;
}
