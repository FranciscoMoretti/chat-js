/* oxlint-disable import/max-dependencies -- The additional readonly message-part dependency is erased and describes the historical validation seam; it adds no runtime module evaluation. */
import { Client, defaultMessageReducer } from "eve/client";
import { attachmentDigest, draftAttachment } from "./draft";

import type { ReadonlyEveMessagePart } from "./readonly-message-types";
import type { SessionSnapshot } from "eve/client";
import { config } from "@/lib/config";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  canReadEveFile,
  reserveEveUpload,
  writeEveUpload,
} from "@/lib/db/eve-files";
/* oxlint-enable sort-imports */
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
  readonly read: () => Promise<Blob> | ReturnType<typeof downloadFile>;
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

/* oxlint-disable typescript/prefer-readonly-parameter-types -- Replay accepts the original shallow readonly SDK snapshot and forwards its original mutable events to reducer.reduce; deep readonly projections are rejected by the SDK receiver (pinned TS2345 proof). */
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
/* oxlint-enable typescript/prefer-readonly-parameter-types */

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
  // oxlint-disable-next-line oxc/no-optional-chaining -- Preserve the original single guard read; attach separately reads the original session ID again.
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

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (restoreMessageAttachments); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve restoreMessageAttachments's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable max-lines-per-function, max-statements -- Preflight and copying keep their original await continuations; extracting async admission or copy phases inserts observable reaction turns between metadata, original part reads, copying and public settlement. */
/* oxlint-disable typescript/promise-function-async -- Stored read callbacks forward original download promises and inline read callbacks retain their Blob promises. */
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
          read: () => Promise.resolve(inlineAttachment(url, contentType)),
        });
      } else {
        const key = storedHistoricalAttachmentKey(url);
        // oxlint-disable-next-line eslint/no-await-in-loop -- Validate original file ownership before metadata and the next part.
        const access = await canReadEveFile(key, ownerId);
        if (!access.allowed) {
          throw new Error("This attachment is unavailable for editing.");
        }
        // oxlint-disable-next-line eslint/no-await-in-loop -- Metadata validation, descriptor admission and the next original part read share this continuation.
        const metadata = await getFileMetadata(key);
        validateAttachment(metadata, contentType);
        files.push({ contentType, name, read: () => downloadFile(key) });
      }
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
        // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing copied own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
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
/* oxlint-enable max-lines-per-function, max-statements, typescript/promise-function-async */
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable import/max-dependencies */
