/* oxlint-disable import/no-relative-parent-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../config"; "../file-storage"; "../file-url" dependency within this package instead of introducing an alias or barrel API.
 */
import type { UserContent } from "ai";

import { config } from "../config";
import { downloadFile } from "../file-storage";
import { keyFromFileUrl } from "../file-url";
import type { EveMessageInput } from "./message-input";
import { loadEveModelDefinition } from "./model-selection";
/* oxlint-enable import/no-relative-parent-imports */

/* oxlint-disable jsdoc/require-param, jsdoc/require-returns, max-statements, no-continue, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions --
 * jsdoc/require-param (#534): prepareEveMessage's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): prepareEveMessage's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * max-statements (#512): prepareEveMessage keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-continue (#515): prepareEveMessage skips inapplicable loop entries explicitly; moving the remaining work into nested branches changes the control-flow boundary.
 * typescript/prefer-readonly-parameter-types (#565): prepareEveMessage accepts message: EveMessageInput; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): prepareEveMessage intentionally keeps the existing falsy-value behavior of key; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
/** Resolve application storage directly, never fetch a client-supplied host. */
export const prepareEveMessage = async (
  message: EveMessageInput,
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
      part.mediaType === "application/pdf"
        ? model.input.pdf
        : model.input.image;
    if (!supported) {
      throw new Error(
        "The selected model does not support this attachment type."
      );
    }
    const key = keyFromFileUrl(part.data);
    if (!key) {
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
/* oxlint-enable jsdoc/require-param, jsdoc/require-returns, max-statements, no-continue, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */
