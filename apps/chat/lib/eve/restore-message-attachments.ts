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

const parseContentType = (value: string) => {
  const parsed = draftAttachment.shape.contentType.safeParse(value);
  if (!parsed.success) {
    throw new Error("This attachment has an unsupported type or size.");
  }
  return parsed.data;
};

const validateAttachment = (
  file: Pick<Blob, "type" | "size">,
  contentType: string
) => {
  if (
    file.type !== contentType ||
    file.size === 0 ||
    file.size > config.attachments.maxBytes
  ) {
    throw new Error("This attachment has an unsupported type or size.");
  }
};

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
  // oxlint-disable-next-line unicorn/no-array-reduce -- Project trusted native history with EVE's reducer.
  const { messages } = snapshot.events.reduce(
    reducer.reduce,
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
