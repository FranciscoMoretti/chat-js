import { Client, defaultMessageReducer } from "eve/client";
import { attachmentDigest, draftAttachment } from "./draft";

import type { ReadonlyEveMessagePart } from "./readonly-message-types";
import type { SessionSnapshot } from "eve/client";
import { config } from "@/lib/config";
import {
  canReadEveFile,
  reserveEveUpload,
  writeEveUpload,
} from "@/lib/db/eve-files";
import {
  createFileId,
  downloadFile,
  getFileMetadata,
  uploadFileAtKey,
} from "@/lib/file-storage";
import { assertEveConfigured } from "./server";
import { getEveConnectionOptions } from "./connection-options";
import { getEveConversation } from "@/lib/db/eve-queries";
import { keyFromFileUrl } from "@/lib/file-url";

import type { z } from "zod";

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

interface HistoricalAttachment {
  readonly contentType: ReturnType<typeof parseContentType>;
  readonly name: string;
  readonly read: () => Blob | Promise<Blob> | ReturnType<typeof downloadFile>;
}

const storedHistoricalAttachmentKey = (url: string): string => {
  const key = keyFromFileUrl(url);
  if (typeof key !== "string" || key === "") {
    throw new Error("Invalid attachment reference.");
  }
  return key;
};

const describeHistoricalAttachment = (
  part: Extract<ReadonlyEveMessagePart, { type: "file" }>
): {
  readonly contentType: HistoricalAttachment["contentType"];
  readonly name: string;
  readonly url: string;
} => {
  const contentType = parseContentType(part.mediaType);
  const { url } = part;
  if (typeof url !== "string" || url === "") {
    throw new Error("This attachment is unavailable for editing.");
  }
  const name = part.filename ?? "attachment";
  return { contentType, name, url };
};

const replayHistoricalUserMessage = (
  snapshot: Readonly<SessionSnapshot>,
  input: Readonly<{ messageId: string }>
): ReturnType<
  ReturnType<typeof defaultMessageReducer>["initial"]
>["messages"][number] => {
  const reducer = defaultMessageReducer();
  const reduceEvent = reducer.reduce.bind(reducer);
  let state = reducer.initial();
  for (const event of snapshot.events) {
    state = reduceEvent(state, event);
  }
  const { messages } = state;
  const message = messages.find(
    (item: Readonly<Pick<(typeof messages)[number], "id" | "role">>) =>
      item.id === input.messageId && item.role === "user"
  );
  if (!message) {
    throw new Error("Message is unavailable for editing.");
  }
  return message;
};

type HistoricalConversation = Readonly<
  Pick<
    NonNullable<Awaited<ReturnType<typeof getEveConversation>>>,
    "sessionId" | "state"
  >
>;

const isBoundHistoricalConversation = (
  conversation: HistoricalConversation | null | undefined
): conversation is HistoricalConversation & {
  readonly sessionId: string;
  readonly state: "bound";
} => {
  const sessionId = conversation?.sessionId;
  if (!conversation) {
    return false;
  }
  return (
    typeof sessionId === "string" &&
    sessionId !== "" &&
    conversation.state === "bound"
  );
};

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
  if (!isBoundHistoricalConversation(conversation)) {
    throw new Error("Conversation is unavailable for editing.");
  }
  assertEveConfigured();
  const client = new Client(getEveConnectionOptions(ownerId));
  const snapshot = await client.sessions
    .attach(conversation.sessionId)
    .snapshot({ signal: AbortSignal.timeout(HISTORY_READ_TIMEOUT_MS) });
  const message = replayHistoricalUserMessage(snapshot, input);
  const files: HistoricalAttachment[] = [];
  for (const part of message.parts) {
    if (part.type === "file") {
      const { contentType, name, url } = describeHistoricalAttachment(part);
      if (url.startsWith(`data:${contentType};base64,`)) {
        inlineAttachment(url, contentType);
        files.push({
          contentType,
          name,
          read: () => inlineAttachment(url, contentType),
        });
      } else {
        const key = storedHistoricalAttachmentKey(url);
        // oxlint-disable-next-line eslint/no-await-in-loop -- Validate original-part ownership before admitting descriptors, then reserve, copy, and digest one file's bytes before starting the next; restore tests cover validation before writes.
        const access = await canReadEveFile(key, ownerId);
        if (!access.allowed) {
          throw new Error("This attachment is unavailable for editing.");
        }
        // oxlint-disable-next-line eslint/no-await-in-loop -- Validate original-part ownership before admitting descriptors, then reserve, copy, and digest one file's bytes before starting the next; restore tests cover validation before writes.
        const metadata = await getFileMetadata(key);
        validateAttachment(metadata, contentType);
        files.push({
          contentType,
          name,
          read: async () => await downloadFile(key),
        });
      }
    }
  }

  const attachments = [];
  for (const { contentType, name, read } of files) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- Validate original-part ownership before admitting descriptors, then reserve, copy, and digest one file's bytes before starting the next; restore tests cover validation before writes.
    const blob = await read();
    validateAttachment(blob, contentType);
    // oxlint-disable-next-line eslint/no-await-in-loop -- Validate original-part ownership before admitting descriptors, then reserve, copy, and digest one file's bytes before starting the next; restore tests cover validation before writes.
    const bytes = await blob.arrayBuffer();
    const key = createFileId();
    // oxlint-disable-next-line eslint/no-await-in-loop -- Validate original-part ownership before admitting descriptors, then reserve, copy, and digest one file's bytes before starting the next; restore tests cover validation before writes.
    await reserveEveUpload(ownerId, key);
    // oxlint-disable-next-line eslint/no-await-in-loop -- Validate original-part ownership before admitting descriptors, then reserve, copy, and digest one file's bytes before starting the next; restore tests cover validation before writes.
    const copied = await writeEveUpload(
      ownerId,
      key,
      async () => await uploadFileAtKey(key, name, bytes, contentType)
    );
    attachments.push(
      draftAttachment.parse({
        ...copied,
        contentType,
        // oxlint-disable-next-line eslint/no-await-in-loop -- Validate original-part ownership before admitting descriptors, then reserve, copy, and digest one file's bytes before starting the next; restore tests cover validation before writes.
        digest: await attachmentDigest(bytes),
        name,
      })
    );
  }
  return attachments;
};
