import type { FileUIPart, ModelMessage } from "ai";
import { z } from "zod";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
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

/* oxlint-enable sort-imports */

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
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (eveImageContext); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */

/* oxlint-disable max-statements, no-continue --
 * max-statements (#512): eveImageContext keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-continue (#515): eveImageContext skips inapplicable loop entries explicitly; moving the remaining work into nested branches changes the control-flow boundary.
 */
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
  /* oxlint-disable unicorn/no-null -- The public image context uses null until a valid generated storage image is found; callers distinguish that absence from an image descriptor. */
  let lastGeneratedImage: {
    imageUrl: string;
    name: string;
  } | null = null;
  /* oxlint-enable unicorn/no-null */
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
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable max-statements, no-continue */
