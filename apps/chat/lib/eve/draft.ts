import { z } from "zod";
import { type EveMessageInput, eveMessageInput } from "./message-input";

export const draftAttachment = z.object({
  url: z.string(),
  name: z.string(),
  contentType: z.enum(["image/jpeg", "image/png", "application/pdf"]),
  digest: z.string(),
});
export type DraftAttachment = z.infer<typeof draftAttachment>;

export function draftMessage(
  text: string,
  attachments: DraftAttachment[]
): EveMessageInput {
  if (!attachments.length) {
    return eveMessageInput.parse(text);
  }
  return eveMessageInput.parse([
    ...(text.trim() ? [{ type: "text", text }] : []),
    ...attachments.map((file) => ({
      type: "file",
      data: file.url,
      filename: file.name,
      mediaType: file.contentType,
    })),
  ]);
}

export async function attachmentDigest(bytes: ArrayBuffer) {
  return Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    (byte) => byte.toString(16).padStart(2, "0")
  ).join("");
}

const receivedContent = z.array(
  z.union([
    z.object({ type: z.literal("text"), text: z.string() }),
    z.object({
      type: z.literal("file"),
      url: z.string(),
      filename: z.string(),
      mediaType: z.string(),
    }),
  ])
);

/** Compare accepted bytes, not transient storage URLs or filenames alone. */
export async function matchesDraft(
  message: unknown,
  text: string,
  attachments: DraftAttachment[]
) {
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
        (char) => char.charCodeAt(0)
      );
      if ((await attachmentDigest(bytes.buffer)) !== expected.digest) {
        return false;
      }
    } catch {
      return false;
    }
  }
  return true;
}
