import type { FileUIPart, ModelMessage } from "ai";
import { z } from "zod";
import { keyFromFileUrl } from "../file-url";

const imageResult = z.object({
  imageUrl: z.string(),
  prompt: z.string().optional(),
});

/** Derive image references from the native branch, without another image-history store. */
export function eveImageContext(messages: readonly ModelMessage[]) {
  const attachments = latestImageAttachments(messages);
  let lastGeneratedImage: { imageUrl: string; name: string } | null = null;
  for (const message of messages) {
    if (message.role !== "tool") {
      continue;
    }
    for (const part of message.content) {
      if (
        part.type !== "tool-result" ||
        part.toolName !== "generateImage" ||
        part.output.type !== "json"
      ) {
        continue;
      }
      const parsed = imageResult.safeParse(part.output.value);
      if (
        parsed.success &&
        parsed.data.imageUrl.startsWith("/api/files/content?") &&
        keyFromFileUrl(parsed.data.imageUrl)
      ) {
        lastGeneratedImage = {
          imageUrl: parsed.data.imageUrl,
          name: `generated-image-${part.toolCallId}.png`,
        };
      }
    }
  }
  return { attachments, lastGeneratedImage };
}

function latestImageAttachments(messages: readonly ModelMessage[]) {
  const user = messages.findLast((message) => message.role === "user");
  const attachments: FileUIPart[] = [];
  if (user && Array.isArray(user.content)) {
    for (const part of user.content) {
      if (
        part.type === "file" &&
        part.mediaType.startsWith("image/") &&
        typeof part.data === "string" &&
        part.data.startsWith("data:image/")
      ) {
        attachments.push({
          type: "file",
          mediaType: part.mediaType,
          url: part.data,
          filename: part.filename,
        });
      }
    }
  }
  return attachments;
}
