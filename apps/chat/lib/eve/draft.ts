import { z } from "zod";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { eveMessageInput } from "./message-input";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { EveMessageInput } from "./message-input";
/* oxlint-enable sort-imports */
import type { ReadonlyEveMessageInput } from "./readonly-message-types";

const EMPTY_ATTACHMENT_COUNT = 0;
const HEX_RADIX = 16;
const HEX_BYTE_WIDTH = 2;

const draftAttachment = z.object({
  contentType: z.enum(["image/jpeg", "image/png", "application/pdf"]),
  digest: z.string(),
  name: z.string(),
  url: z.string(),
});

type DraftAttachment = z.infer<typeof draftAttachment>;

const restoreDraft = (
  message: ReadonlyEveMessageInput
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

const draftMessage = (
  text: string,
  attachments: readonly Readonly<DraftAttachment>[]
): EveMessageInput => {
  if (attachments.length === EMPTY_ATTACHMENT_COUNT) {
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

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve attachmentDigest's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable typescript/prefer-readonly-parameter-types --
typescript/prefer-readonly-parameter-types (#565): attachmentDigest accepts bytes: ArrayBuffer; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration. */
const attachmentDigest = async (bytes: ArrayBuffer): Promise<string> =>
  Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    (byte) => byte.toString(HEX_RADIX).padStart(HEX_BYTE_WIDTH, "0")
  ).join("");
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
export { attachmentDigest, draftAttachment, draftMessage, restoreDraft };
export type { DraftAttachment };
