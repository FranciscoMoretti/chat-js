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

/* oxlint-disable jsdoc/require-param, jsdoc/require-returns, max-statements, no-continue, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null --
 * jsdoc/require-param (#534): eveImageContext's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): eveImageContext's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * max-statements (#512): eveImageContext keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-continue (#515): eveImageContext skips inapplicable loop entries explicitly; moving the remaining work into nested branches changes the control-flow boundary.
 * typescript/prefer-readonly-parameter-types (#565): eveImageContext accepts messages: readonly ModelMessage[]; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): eveImageContext intentionally keeps the existing falsy-value behavior of keyFromFileUrl(parsed.data.imageUrl); distinguishing empty, zero, and absent states requires a domain behavior decision.
 * unicorn/no-null (#570): eveImageContext preserves explicit null in its storage/API state; undefined has different serialization and presence semantics.
 */
/** Derive image references from the native branch, without another image-history store. */
export const eveImageContext = (
  messages: readonly ModelMessage[]
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
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable jsdoc/require-param, jsdoc/require-returns, max-statements, no-continue, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null */
