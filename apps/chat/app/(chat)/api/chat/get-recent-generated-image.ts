import type { ChatMessage } from "@/lib/ai/types";

export const getRecentGeneratedImage = (
  messages: ChatMessage[]
): { imageUrl: string; name: string } | null => {
  const lastAssistantMessage = messages.findLast(
    (message) => message.role === "assistant"
  );

  if (lastAssistantMessage?.parts && lastAssistantMessage.parts.length > 0) {
    for (const part of lastAssistantMessage.parts) {
      if (
        part.type === "tool-generateImage" &&
        part.state === "output-available" &&
        part.output?.imageUrl
      ) {
        return {
          imageUrl: part.output.imageUrl,
          name: `generated-image-${part.toolCallId}.png`,
        };
      }
    }
  }

  return null;
};
