import type { UserContent } from "ai";

import { config } from "@/lib/config";
import { downloadFile } from "@/lib/file-storage";
import { keyFromFileUrl } from "@/lib/file-url";

import { loadEveModelDefinition } from "./model-selection";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { ReadonlyEveMessageInput } from "./readonly-message-types";
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (prepareEveMessage); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve prepareEveMessage's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable sort-imports */

/* oxlint-disable max-statements, no-continue --
 * max-statements (#512): prepareEveMessage keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-continue (#515): prepareEveMessage skips inapplicable loop entries explicitly; moving the remaining work into nested branches changes the control-flow boundary.
 */
/**
 * Resolve application storage directly, never fetch a client-supplied host.
 * @param {ReadonlyEveMessageInput} message Validated user text or attachment references owned by application storage.
 * @param {string | undefined} modelId Model whose PDF/image capabilities must permit each attachment.
 * @returns {Promise<string | UserContent>} The original text, or ordered model content with checked files embedded as data URLs.
 */
export const prepareEveMessage = async (
  message: ReadonlyEveMessageInput,
  modelId?: string
): Promise<string | UserContent> => {
  if (typeof message === "string") {
    return message;
  }
  const model = await loadEveModelDefinition(modelId);
  const content: UserContent = [];
  for (const part of message) {
    if (part.type === "text") {
      content.push(part);
      continue;
    }
    const supported =
      // oxlint-disable-next-line no-ternary -- Keep supported as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
      part.mediaType === "application/pdf"
        ? model.input.pdf
        : model.input.image;
    if (!supported) {
      throw new Error(
        "The selected model does not support this attachment type."
      );
    }
    const key = keyFromFileUrl(part.data);
    if (key === null || key === "") {
      throw new Error("Invalid attachment reference.");
    }
    // oxlint-disable-next-line eslint/no-await-in-loop -- Bound attachment memory and finish each owned write before proceeding.
    const file = await downloadFile(key);
    if (
      file.size > config.attachments.maxBytes ||
      file.type !== part.mediaType
    ) {
      throw new Error(
        "The attachment has an unsupported size or content type."
      );
    }
    content.push({
      // oxlint-disable-next-line eslint/no-await-in-loop -- Bound attachment memory and finish each owned write before proceeding.
      data: `data:${file.type};base64,${Buffer.from(await file.arrayBuffer()).toString("base64")}`,
      filename: part.filename,
      mediaType: file.type,
      type: "file",
    });
  }
  return content;
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable max-statements, no-continue */
