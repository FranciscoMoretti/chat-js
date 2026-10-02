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
  const attachments = [];
  for (const part of message.parts) {
    if (part.type !== "file") {
      continue;
    }
    const contentType = draftAttachment.shape.contentType.parse(part.mediaType);
    if (!part.url) {
      throw new Error("This attachment is unavailable for editing.");
    }
    let blob: Pick<Blob, "type" | "size" | "arrayBuffer">;
    if (part.url.startsWith(`data:${contentType};base64,`)) {
      const encoded = part.url.slice(part.url.indexOf(",") + 1);
      if (encoded.length > 4 * Math.ceil(config.attachments.maxBytes / 3)) {
        throw new Error("This attachment has an unsupported type or size.");
      }
      const bytes = Buffer.from(encoded, "base64");
      if (!encoded || bytes.toString("base64") !== encoded) {
        throw new Error("Invalid attachment reference.");
      }
      blob = new Blob([bytes], { type: contentType });
    } else {
      const key = keyFromFileUrl(part.url);
      if (!key) {
        throw new Error("Invalid attachment reference.");
      }
      // oxlint-disable-next-line eslint/no-await-in-loop -- Check each historical file's current access before reading.
      const access = await canReadEveFile(key, ownerId);
      if (!access.allowed) {
        throw new Error("This attachment is unavailable for editing.");
      }
      // oxlint-disable-next-line eslint/no-await-in-loop -- Reject oversized stored files before reading their bytes.
      const metadata = await getFileMetadata(key);
      if (!metadata.size || metadata.size > config.attachments.maxBytes) {
        throw new Error("This attachment has an unsupported type or size.");
      }
      // oxlint-disable-next-line eslint/no-await-in-loop -- Bound restored file memory.
      blob = await downloadFile(key);
    }
    if (
      blob.type !== contentType ||
      !blob.size ||
      blob.size > config.attachments.maxBytes
    ) {
      throw new Error("This attachment has an unsupported type or size.");
    }
    const name = part.filename ?? "attachment";
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
