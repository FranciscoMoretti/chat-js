import type { ChatMessage } from "@/lib/ai/types";

export function getRecentGeneratedImage(
  messages: ChatMessage[]
): { imageUrl: string; mediaType: string; name: string } | null {
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
        const mediaType = part.output.mediaType ?? "image/png";
        const extension = mediaType.split("/")[1]?.split(";")[0] || "png";
        return {
          imageUrl: part.output.imageUrl,
          mediaType,
          name: `generated-image-${part.toolCallId}.${extension}`,
        };
      }
    }
  }

  return null;
}
