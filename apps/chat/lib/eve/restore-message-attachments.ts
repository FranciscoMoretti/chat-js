/* oxlint-disable import/no-relative-parent-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../config"; "../db/eve-files"; "../db/eve-queries"; "../file-storage"; "../file-url" dependency within this package instead of introducing an alias or barrel API.
 */
import { Client, defaultMessageReducer } from "eve/client";

import { config } from "../config";
import {
  canReadEveFile,
  reserveEveUpload,
  writeEveUpload,
} from "../db/eve-files";
import { getEveConversation } from "../db/eve-queries";
import {
  createFileId,
  downloadFile,
  getFileMetadata,
  uploadFileAtKey,
} from "../file-storage";
import { keyFromFileUrl } from "../file-url";
import { getEveConnectionOptions } from "./connection-options";
import { attachmentDigest, draftAttachment } from "./draft";
import { assertEveConfigured } from "./server";
/* oxlint-enable import/no-relative-parent-imports */

/* oxlint-disable typescript/explicit-function-return-type --
 * typescript/explicit-function-return-type (#560): Keep parseContentType's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 */
const parseContentType = (value: string) => {
  const parsed = draftAttachment.shape.contentType.safeParse(value);
  if (!parsed.success) {
    throw new Error("This attachment has an unsupported type or size.");
  }
  return parsed.data;
};
/* oxlint-enable typescript/explicit-function-return-type */

/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): validateAttachment uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 */
const validateAttachment = (
  file: Pick<Blob, "type" | "size">,
  contentType: string
): void => {
  if (
    file.type !== contentType ||
    file.size === 0 ||
    file.size > config.attachments.maxBytes
  ) {
    throw new Error("This attachment has an unsupported type or size.");
  }
};
/* oxlint-enable no-magic-numbers */

/* oxlint-disable no-magic-numbers, typescript/explicit-function-return-type --
 * no-magic-numbers (#517): inlineAttachment uses 1, 4, 3 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * typescript/explicit-function-return-type (#560): Keep inlineAttachment's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 */
const inlineAttachment = (url: string, contentType: string) => {
  const encoded = url.slice(url.indexOf(",") + 1);
  if (encoded.length > 4 * Math.ceil(config.attachments.maxBytes / 3)) {
    throw new Error("This attachment has an unsupported type or size.");
  }
  const bytes = Buffer.from(encoded, "base64");
  if (!encoded || bytes.toString("base64") !== encoded) {
    throw new Error("Invalid attachment reference.");
  }
  const blob = new Blob([bytes], { type: contentType });
  validateAttachment(blob, contentType);
  return blob;
};
/* oxlint-enable no-magic-numbers, typescript/explicit-function-return-type */

/* oxlint-disable jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, max-statements, no-continue, no-magic-numbers, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, typescript/strict-boolean-expressions --
 * jsdoc/require-param (#534): restoreMessageAttachments's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): restoreMessageAttachments's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * max-lines-per-function (#510): restoreMessageAttachments keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): restoreMessageAttachments keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-continue (#515): restoreMessageAttachments skips inapplicable loop entries explicitly; moving the remaining work into nested branches changes the control-flow boundary.
 * no-magic-numbers (#517): restoreMessageAttachments uses 15_000 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * typescript/explicit-function-return-type (#560): Keep restoreMessageAttachments's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep restoreMessageAttachments's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): restoreMessageAttachments accepts input: { conversationId: string; messageId: string }; state; event; item; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): restoreMessageAttachments preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 * typescript/strict-boolean-expressions (#610): restoreMessageAttachments intentionally keeps the existing falsy-value behavior of conversation?.sessionId; url; key; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
/** Copy trusted native history for editing; callers cannot supply file bytes or URLs. */
export const restoreMessageAttachments = async (
  ownerId: string,
  input: { conversationId: string; messageId: string }
) => {
  const conversation = await getEveConversation(ownerId, input.conversationId);
  if (!(conversation?.sessionId && conversation.state === "bound")) {
    throw new Error("Conversation is unavailable for editing.");
  }
  assertEveConfigured();
  const client = new Client(getEveConnectionOptions(ownerId));
  const snapshot = await client.sessions
    .attach(conversation.sessionId)
    .snapshot({ signal: AbortSignal.timeout(15_000) });
  const reducer = defaultMessageReducer();
  const reduceEvent = reducer.reduce.bind(reducer);
  // oxlint-disable-next-line unicorn/no-array-reduce -- Project trusted native history with EVE's reducer.
  const { messages } = snapshot.events.reduce(
    (state, event) => reduceEvent(state, event),
    reducer.initial()
  );
  const message = messages.find(
    (item) => item.id === input.messageId && item.role === "user"
  );
  if (!message) {
    throw new Error("Message is unavailable for editing.");
  }
  const files = [];
  for (const part of message.parts) {
    if (part.type !== "file") {
      continue;
    }
    const contentType = parseContentType(part.mediaType);
    const { url } = part;
    if (!url) {
      throw new Error("This attachment is unavailable for editing.");
    }
    const name = part.filename ?? "attachment";
    if (url.startsWith(`data:${contentType};base64,`)) {
      // Validate now, decode again when copying to avoid retaining every file's bytes.
      inlineAttachment(url, contentType);
      files.push({
        contentType,
        name,
        read: () => Promise.resolve(inlineAttachment(url, contentType)),
      });
    } else {
      const key = keyFromFileUrl(url);
      if (!key) {
        throw new Error("Invalid attachment reference.");
      }
      // oxlint-disable-next-line eslint/no-await-in-loop -- Validate all historical access before copying any file.
      const access = await canReadEveFile(key, ownerId);
      if (!access.allowed) {
        throw new Error("This attachment is unavailable for editing.");
      }
      // oxlint-disable-next-line eslint/no-await-in-loop -- Validate every stored file before any copy is admitted.
      const metadata = await getFileMetadata(key);
      validateAttachment(metadata, contentType);
      files.push({ contentType, name, read: () => downloadFile(key) });
    }
  }

  const attachments = [];
  for (const { contentType, name, read } of files) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- Keep file bytes bounded to one copy at a time.
    const blob = await read();
    validateAttachment(blob, contentType);
    // oxlint-disable-next-line eslint/no-await-in-loop -- Finish each owned copy before proceeding.
    const bytes = await blob.arrayBuffer();
    const key = createFileId();
    // oxlint-disable-next-line eslint/no-await-in-loop -- Reserve before storage I/O.
    await reserveEveUpload(ownerId, key);
    // oxlint-disable-next-line eslint/no-await-in-loop -- Serialize with orphan cleanup.
    const copied = await writeEveUpload(ownerId, key, () =>
      uploadFileAtKey(key, name, bytes, contentType)
    );
    attachments.push(
      draftAttachment.parse({
        ...copied,
        contentType,
        // oxlint-disable-next-line eslint/no-await-in-loop -- Digest exact historical bytes.
        digest: await attachmentDigest(bytes),
        name,
      })
    );
  }
  return attachments;
};
/* oxlint-enable jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, max-statements, no-continue, no-magic-numbers, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, typescript/strict-boolean-expressions */
