import { z } from "zod";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { eveMessageInput } from "./message-input";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { EveMessageInput } from "./message-input";
/* oxlint-enable sort-imports */
import type { ReadonlyEveMessageInput } from "./readonly-message-types";

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
  // oxlint-disable-next-line no-magic-numbers -- A draft without attachments retains the native text-only input shape.
  if (attachments.length === 0) {
    return eveMessageInput.parse(text);
  }
  return eveMessageInput.parse([
    // oxlint-disable-next-line no-ternary -- Keep iterable spread as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
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
const attachmentDigest = async (
  bytes: Readonly<ArrayBuffer>
): Promise<string> =>
  Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    (byte) => byte.toString(HEX_RADIX).padStart(HEX_BYTE_WIDTH, "0")
  ).join("");
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (attachmentDigest, draftAttachment, draftMessage, restoreDraft); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable oxc/no-async-await */
export { attachmentDigest, draftAttachment, draftMessage, restoreDraft };
/* oxlint-enable import/no-named-export */
/* oxlint-disable import/no-named-export -- Keep the named type bindings (DraftAttachment); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export type { DraftAttachment };
/* oxlint-enable import/no-named-export */
