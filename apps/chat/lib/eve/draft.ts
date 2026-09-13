import { z } from "zod";

import { eveMessageInput } from "./message-input";
import type { EveMessageInput } from "./message-input";

export const draftAttachment = z.object({
  contentType: z.enum(["image/jpeg", "image/png", "application/pdf"]),
  digest: z.string(),
  name: z.string(),
  url: z.string(),
});
export type DraftAttachment = z.infer<typeof draftAttachment>;

export const restoreDraft = (
  message: EveMessageInput
): {
  text: string;
  attachments: DraftAttachment[];
} => {
  if (typeof message === "string") {
    return { attachments: [], text: message };
  }
  return {
    attachments: message
      .filter((part) => part.type === "file")
      .map((part) => ({
        contentType: part.mediaType,
        digest: "",
        name: part.filename,
        url: part.data,
      })),
    text: message
      .filter((part) => part.type === "text")
      .map((part) => part.text)
      .join("\n"),
  };
};

export const draftMessage = (
  text: string,
  attachments: DraftAttachment[]
): EveMessageInput => {
  if (!attachments.length) {
    return eveMessageInput.parse(text);
  }
  return eveMessageInput.parse([
    ...(text.trim() ? [{ text, type: "text" }] : []),
    ...attachments.map((file) => ({
      data: file.url,
      filename: file.name,
      mediaType: file.contentType,
      type: "file",
    })),
  ]);
};

export const attachmentDigest = async (bytes: ArrayBuffer) =>
  Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    (byte) => byte.toString(16).padStart(2, "0")
  ).join("");

const receivedContent = z.array(
  z.union([
    z.object({ text: z.string(), type: z.literal("text") }),
    z.object({
      filename: z.string(),
      mediaType: z.string(),
      type: z.literal("file"),
      url: z.string(),
    }),
  ])
);

/** Compare accepted bytes, not transient storage URLs or filenames alone. */
export const matchesDraft = async (
  message: unknown,
  text: string,
  attachments: DraftAttachment[]
) => {
  if (!attachments.length && typeof message === "string") {
    return message === text.trim();
  }
  const parsed = receivedContent.safeParse(message);
  if (!parsed.success) {
    return false;
  }
  const receivedText = parsed.data
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("");
  const files = parsed.data.filter((part) => part.type === "file");
  if (receivedText !== text.trim() || files.length !== attachments.length) {
    return false;
  }
  for (const [index, file] of files.entries()) {
    const expected = attachments[index];
    if (
      !expected ||
      file.filename !== expected.name ||
      file.mediaType !== expected.contentType ||
      !file.url.startsWith(`data:${file.mediaType};base64,`)
    ) {
      return false;
    }
    try {
      const bytes = Uint8Array.from(
        atob(file.url.slice(file.url.indexOf(",") + 1)),
        (char) => char.codePointAt(0) ?? 0
      );
      // oxlint-disable-next-line eslint/no-await-in-loop -- Bound attachment memory and finish each owned write before proceeding.
      if ((await attachmentDigest(bytes.buffer)) !== expected.digest) {
        return false;
      }
    } catch {
      return false;
    }
  }
  return true;
};
