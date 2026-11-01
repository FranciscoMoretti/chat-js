import type { FileUIPart, ModelMessage } from "ai";
import { z } from "zod";

import { keyFromFileUrl } from "@/lib/file-url";

/** SDK fields this reader does not inspect remain optional and opaque. */
type IgnoredSdkFields<Value> = Value extends object
  ? { readonly [Key in keyof Value]?: unknown }
  : unknown;

type UserContentPart = Exclude<
  Extract<ModelMessage, { role: "user" }>["content"],
  string
>[number];
type ToolContentPart = Extract<
  ModelMessage,
  { role: "tool" }
>["content"][number];

interface ImageContextUserMessage extends IgnoredSdkFields<
  Extract<ModelMessage, { role: "user" }>
> {
  readonly role: "user";
  readonly content:
    | string
    | readonly (IgnoredSdkFields<UserContentPart> &
        (
          | {
              readonly type: "file";
              readonly mediaType: string;
              readonly data: unknown;
              readonly filename?: string;
            }
          | { readonly type: "text" | "image" }
        ))[];
}
type ImageContextMessage = IgnoredSdkFields<ModelMessage> &
  (
    | ImageContextUserMessage
    | {
        readonly role: "tool";
        readonly content: readonly (IgnoredSdkFields<ToolContentPart> &
          (
            | {
                readonly type: "tool-result";
                readonly toolName: string;
                readonly toolCallId: string;
                readonly output: {
                  readonly type: string;
                  readonly value?: unknown;
                } & IgnoredSdkFields<
                  Extract<ToolContentPart, { type: "tool-result" }>["output"]
                >;
              }
            | { readonly type: "tool-approval-response" }
          ))[];
      }
    | { readonly role: Exclude<ModelMessage["role"], "user" | "tool"> }
  );

/** Preserve the native array check while retaining the readonly content element contract. */
const isImageContentArray: (
  content: ImageContextUserMessage["content"]
) => content is Exclude<ImageContextUserMessage["content"], string> =
  Array.isArray;

const imageResult = z.object({
  imageUrl: z.string(),
  prompt: z.string().optional(),
});

const latestImageAttachments = (
  messages: readonly ImageContextMessage[]
): FileUIPart[] => {
  const user = messages.findLast(
    (message: {
      readonly role: ModelMessage["role"];
    }): message is ImageContextUserMessage => message.role === "user"
  );
  const attachments: FileUIPart[] = [];
  if (user && isImageContentArray(user.content)) {
    for (const part of user.content) {
      if (
        part.type === "file" &&
        part.mediaType.startsWith("image/") &&
        typeof part.data === "string" &&
        part.data.startsWith("data:image/")
      ) {
        attachments.push({
          filename: part.filename,
          mediaType: part.mediaType,
          type: "file",
          url: part.data,
        });
      }
    }
  }

  return attachments;
};

/** Derive image references from the native branch, without another image-history store.
 * @param {readonly ModelMessage[]} messages Ordered native branch messages. Only the latest user message supplies inline image attachments.
 * @returns {{ attachments: FileUIPart[]; lastGeneratedImage: { imageUrl: string; name: string } | null }} Inline data-image attachments and the last valid generateImage storage-file result in branch order, or null when no such result exists.
 */
export const eveImageContext = (
  messages: readonly ImageContextMessage[]
): {
  attachments: FileUIPart[];
  lastGeneratedImage: { imageUrl: string; name: string } | null;
} => {
  const attachments = latestImageAttachments(messages);
  let lastGeneratedImage: {
    imageUrl: string;
    name: string;
  } | null = null;
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
        parsed.data.imageUrl.startsWith("/api/files/") &&
        keyFromFileUrl(parsed.data.imageUrl) !== null
      ) {
        lastGeneratedImage = {
          imageUrl: parsed.data.imageUrl,
          name: `generated-image-${part.toolCallId}.png`,
        };
      }
    }
  }
  return { attachments, lastGeneratedImage };
};
