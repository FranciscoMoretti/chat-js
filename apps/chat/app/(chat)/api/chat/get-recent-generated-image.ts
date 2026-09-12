import { z } from "zod";

import type { ChatMessage } from "@/lib/ai/types";

// Optional support for the built-in image result. Other installed schemas are ignored.
const imageResult = z.object({
  output: z.object({ imageUrl: z.string().min(1) }),
  state: z.literal("output-available"),
  toolCallId: z.string(),
  type: z.literal("tool-generateImage"),
});

export function getRecentGeneratedImage(
  messages: ChatMessage[]
): { imageUrl: string; name: string } | null {
  const lastAssistantMessage = messages.findLast(
    (message) => message.role === "assistant"
  );
  for (const part of lastAssistantMessage?.parts ?? []) {
    const result = imageResult.safeParse(part);
    if (result.success) {
      return {
        imageUrl: result.data.output.imageUrl,
        name: `generated-image-${result.data.toolCallId}.png`,
      };
    }
  }
  return null;
}
