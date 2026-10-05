import { Client, defaultMessageReducer } from "eve/client";
import type { z } from "zod";

/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import { config } from "@/lib/config";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  canReadEveFile,
  reserveEveUpload,
  writeEveUpload,
} from "@/lib/db/eve-files";
/* oxlint-enable sort-imports */
import { getEveConversation } from "@/lib/db/eve-queries";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  createFileId,
  downloadFile,
  getFileMetadata,
  uploadFileAtKey,
} from "@/lib/file-storage";
/* oxlint-enable sort-imports */
import { keyFromFileUrl } from "@/lib/file-url";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { getEveConnectionOptions } from "./connection-options";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { attachmentDigest, draftAttachment } from "./draft";
/* oxlint-enable sort-imports */
import { assertEveConfigured } from "./server";

const EMPTY_ATTACHMENT_BYTES = 0;
const DATA_URL_SEPARATOR_LENGTH = 1;
const BASE64_CHARACTERS_PER_QUARTET = 4;
const BASE64_BYTES_PER_QUARTET = 3;
const HISTORY_READ_TIMEOUT_MS = 15_000;

const parseContentType = (
  value: string
): z.infer<typeof draftAttachment>["contentType"] => {
  const parsed = draftAttachment.shape.contentType.safeParse(value);
  if (!parsed.success) {
    throw new Error("This attachment has an unsupported type or size.");
  }
  return parsed.data;
};

const validateAttachment = (
  file: Pick<Blob, "type" | "size">,
  contentType: string
): void => {
  if (
    file.type !== contentType ||
    file.size === EMPTY_ATTACHMENT_BYTES ||
    file.size > config.attachments.maxBytes
  ) {
    throw new Error("This attachment has an unsupported type or size.");
  }
};

const inlineAttachment = (url: string, contentType: string): Blob => {
  const encoded = url.slice(url.indexOf(",") + DATA_URL_SEPARATOR_LENGTH);
  if (
    encoded.length >
    BASE64_CHARACTERS_PER_QUARTET *
      Math.ceil(config.attachments.maxBytes / BASE64_BYTES_PER_QUARTET)
  ) {
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

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (restoreMessageAttachments); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve restoreMessageAttachments's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable max-lines-per-function, max-statements, no-continue, typescript/promise-function-async, typescript/strict-boolean-expressions --
 * max-lines-per-function (#510): restoreMessageAttachments keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): restoreMessageAttachments keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-continue (#515): restoreMessageAttachments skips inapplicable loop entries explicitly; moving the remaining work into nested branches changes the control-flow boundary.
 * typescript/promise-function-async (#606): restoreMessageAttachments preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 * typescript/strict-boolean-expressions (#610): restoreMessageAttachments intentionally keeps the existing falsy-value behavior of conversation?.sessionId; url; key; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
/**
 * Copy trusted native history for editing after validating every historical attachment.
 * @param {string} ownerId Owner whose conversation and file access authorize each copy.
 * @param {Readonly<{ conversationId: string; messageId: string }>} input Conversation and user message identifying the native history to restore.
 * @returns {Promise<z.output<typeof draftAttachment>[]>} Owned attachment references copied sequentially from the validated history.
 */
export const restoreMessageAttachments = async (
  ownerId: string,
  input: Readonly<{ conversationId: string; messageId: string }>
): Promise<z.output<typeof draftAttachment>[]> => {
  const conversation = await getEveConversation(ownerId, input.conversationId);
  if (!(conversation?.sessionId && conversation.state === "bound")) {
    throw new Error("Conversation is unavailable for editing.");
  }
  assertEveConfigured();
  const client = new Client(getEveConnectionOptions(ownerId));
  const snapshot = await client.sessions
    .attach(conversation.sessionId)
    .snapshot({ signal: AbortSignal.timeout(HISTORY_READ_TIMEOUT_MS) });
  const reducer = defaultMessageReducer();
  const reduceEvent = reducer.reduce.bind(reducer);
  // oxlint-disable-next-line unicorn/no-array-reduce -- Project trusted native history with EVE's reducer.
  const { messages } = snapshot.events.reduce(reduceEvent, reducer.initial());
  const message = messages.find(
    (item: Readonly<Pick<(typeof messages)[number], "id" | "role">>) =>
      item.id === input.messageId && item.role === "user"
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
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable max-lines-per-function, max-statements, no-continue, typescript/promise-function-async, typescript/strict-boolean-expressions */
