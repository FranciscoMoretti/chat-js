import { describe, expect, it } from "vitest";
import type { ChatMessage } from "@/lib/ai/types";
import { getRecentGeneratedImage } from "./get-recent-generated-image";

function generatedImageMessage(output: {
  imageUrl: string;
  mediaType?: string;
  prompt: string;
}): ChatMessage {
  return {
    id: "assistant-message",
    metadata: {},
    parts: [
      {
        input: { prompt: output.prompt },
        output,
        state: "output-available",
        toolCallId: "image-call",
        type: "tool-generateImage",
      },
    ],
    role: "assistant",
  } as unknown as ChatMessage;
}

describe("getRecentGeneratedImage", () => {
  it("preserves the generated image media type", () => {
    expect(
      getRecentGeneratedImage([
        generatedImageMessage({
          imageUrl: "/files/generated-image.webp",
          mediaType: "image/webp",
          prompt: "A landscape",
        }),
      ])
    ).toEqual({
      imageUrl: "/files/generated-image.webp",
      mediaType: "image/webp",
      name: "generated-image-image-call.webp",
    });
  });

  it("falls back to PNG for messages created before media types were stored", () => {
    expect(
      getRecentGeneratedImage([
        generatedImageMessage({
          imageUrl: "/files/generated-image.png",
          prompt: "A landscape",
        }),
      ])
    ).toEqual({
      imageUrl: "/files/generated-image.png",
      mediaType: "image/png",
      name: "generated-image-image-call.png",
    });
  });
});
