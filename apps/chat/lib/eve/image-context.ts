/* oxlint-disable import/no-relative-parent-imports  --
 * import/no-relative-parent-imports (#530): Keep the explicit "../file-url" dependency within this package instead of introducing an alias or barrel API.
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
import type { FileUIPart, ModelMessage } from "ai";
import { z } from "zod";

import { keyFromFileUrl } from "../file-url";
/* oxlint-enable import/no-relative-parent-imports */

const imageResult = z.object({
  imageUrl: z.string(),
  prompt: z.string().optional(),
});

/* oxlint-disable typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types --
 * typescript/explicit-function-return-type (#560): Keep latestImageAttachments's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): latestImageAttachments accepts messages: readonly ModelMessage[]; message; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
const latestImageAttachments = (messages: readonly ModelMessage[]) => {
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
/* oxlint-enable typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types */

/* oxlint-disable jsdoc/require-param, jsdoc/require-returns, max-statements, no-continue, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null  --
 * import/no-named-export (#527): Preserve the named eveImageContext API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * import/prefer-default-export (#532): eveImageContext remains a named API, consistent with no-default-export; adding future exports must not change caller import syntax.
 * jsdoc/require-param (#534): eveImageContext's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): eveImageContext's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * max-statements (#512): eveImageContext keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-continue (#515): eveImageContext skips inapplicable loop entries explicitly; moving the remaining work into nested branches changes the control-flow boundary.
 * typescript/explicit-function-return-type (#560): Keep eveImageContext's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep eveImageContext's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): eveImageContext accepts messages: readonly ModelMessage[]; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): eveImageContext intentionally keeps the existing falsy-value behavior of keyFromFileUrl(parsed.data.imageUrl); distinguishing empty, zero, and absent states requires a domain behavior decision.
 * unicorn/no-null (#570): eveImageContext preserves explicit null in its storage/API state; undefined has different serialization and presence semantics.
 */
/** Derive image references from the native branch, without another image-history store. */
export const eveImageContext = (messages: readonly ModelMessage[]) => {
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
/* oxlint-enable jsdoc/require-param, jsdoc/require-returns, max-statements, no-continue, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null */
