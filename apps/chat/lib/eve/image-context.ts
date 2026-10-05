import type { FileUIPart, ModelMessage } from "ai";
import { z } from "zod";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { keyFromFileUrl } from "@/lib/file-url";
/* oxlint-enable sort-imports */

const imageResult = z.object({
  imageUrl: z.string(),
  prompt: z.string().optional(),
});

/* oxlint-disable typescript/prefer-readonly-parameter-types --
 * typescript/prefer-readonly-parameter-types (#565): latestImageAttachments accepts messages: readonly ModelMessage[]; message; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
const latestImageAttachments = (
  messages: readonly ModelMessage[]
): FileUIPart[] => {
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
/* oxlint-enable typescript/prefer-readonly-parameter-types */

/* oxlint-disable max-statements, no-continue, typescript/prefer-readonly-parameter-types --
 * max-statements (#512): eveImageContext keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-continue (#515): eveImageContext skips inapplicable loop entries explicitly; moving the remaining work into nested branches changes the control-flow boundary.
 * typescript/prefer-readonly-parameter-types (#565): eveImageContext accepts messages: readonly ModelMessage[]; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
/** Derive image references from the native branch, without another image-history store.
 * @param {readonly ModelMessage[]} messages Ordered native branch messages. Only the latest user message supplies inline image attachments.
 * @returns {{ attachments: FileUIPart[]; lastGeneratedImage: { imageUrl: string; name: string } | null }} Inline data-image attachments and the last valid generateImage storage-file result in branch order, or null when no such result exists.
 */
export const eveImageContext = (
  messages: readonly ModelMessage[]
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
/* oxlint-enable max-statements, no-continue, typescript/prefer-readonly-parameter-types */
