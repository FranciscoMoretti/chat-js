import { z } from "zod";

import { eveMessageInput } from "./message-input";
import type { EveMessageInput } from "./message-input";

const draftAttachment = z.object({
  contentType: z.enum(["image/jpeg", "image/png", "application/pdf"]),
  digest: z.string(),
  name: z.string(),
  url: z.string(),
});

type DraftAttachment = z.infer<typeof draftAttachment>;

/* oxlint-disable typescript/prefer-readonly-parameter-types -- typescript/prefer-readonly-parameter-types (#565): restoreDraft accepts message: EveMessageInput; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration. */
const restoreDraft = (
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
/* oxlint-enable typescript/prefer-readonly-parameter-types */

/* oxlint-disable no-magic-numbers, typescript/prefer-readonly-parameter-types -- no-magic-numbers (#517): draftMessage uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
typescript/prefer-readonly-parameter-types (#565): draftMessage accepts attachments: DraftAttachment[]; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration. */
const draftMessage = (
  text: string,
  attachments: DraftAttachment[]
): EveMessageInput => {
  if (attachments.length === 0) {
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
/* oxlint-enable no-magic-numbers, typescript/prefer-readonly-parameter-types */

/* oxlint-disable no-magic-numbers, typescript/prefer-readonly-parameter-types -- no-magic-numbers (#517): attachmentDigest uses 16, 2 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
typescript/prefer-readonly-parameter-types (#565): attachmentDigest accepts bytes: ArrayBuffer; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration. */
const attachmentDigest = async (bytes: ArrayBuffer): Promise<string> =>
  Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    (byte) => byte.toString(16).padStart(2, "0")
  ).join("");
/* oxlint-enable no-magic-numbers, typescript/prefer-readonly-parameter-types */
export { attachmentDigest, draftAttachment, draftMessage, restoreDraft };
export type { DraftAttachment };
