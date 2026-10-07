/* oxlint-disable eslint/sort-keys -- Property order is part of persisted EVE request and transcript hashes; keep the original wire representation. */
import { z } from "zod";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { keyFromFileUrl } from "@/lib/file-url";
/* oxlint-enable sort-imports */

const MIN_CONTENT_LENGTH = 1;
const MIN_MESSAGE_PARTS = 1;
const MAX_TEXT_LENGTH = 16_000;
const MAX_FILENAME_LENGTH = 255;
const MAX_TEXT_PARTS = 1;
const MAX_FILE_PARTS = 16;
const MAX_MESSAGE_PARTS = MAX_TEXT_PARTS + MAX_FILE_PARTS;

const textPart = z
  .object({
    type: z.literal("text"),
    text: z.string().trim().min(MIN_CONTENT_LENGTH).max(MAX_TEXT_LENGTH),
  })
  .strict();

const filePart = z
  .object({
    type: z.literal("file"),
    data: z
      .string()
      .refine(
        (value) =>
          value.startsWith("/api/files/") && keyFromFileUrl(value) !== null,
        "Use a ChatJS upload"
      ),
    mediaType: z.enum(["image/jpeg", "image/png", "application/pdf"]),
    filename: z.string().min(MIN_CONTENT_LENGTH).max(MAX_FILENAME_LENGTH),
  })
  .strict();

type EveMessageInputPart = z.infer<typeof textPart> | z.infer<typeof filePart>;

const eveMessageInput = z.union([
  z.string().trim().min(MIN_CONTENT_LENGTH).max(MAX_TEXT_LENGTH),
  z
    .array(z.union([textPart, filePart]))
    .min(MIN_MESSAGE_PARTS)
    .max(MAX_MESSAGE_PARTS)
    .refine(
      (parts: readonly Readonly<EveMessageInputPart>[]) =>
        parts.filter((part) => part.type === "text").length <= MAX_TEXT_PARTS &&
        parts.filter((part) => part.type === "file").length <= MAX_FILE_PARTS
    ),
]);

type EveMessageInput = z.infer<typeof eveMessageInput>;

const eveMessageTitle = (
  message: string | readonly Readonly<EveMessageInputPart>[]
): string => {
  if (typeof message === "string") {
    return message;
  }
  const text = message.find((part) => part.type === "text");
  if (text) {
    return text.text;
  }
  return message
    .filter((part) => part.type === "file")
    .map((part) => part.filename)
    .join(", ");
};

/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (eveMessageInput, eveMessageTitle); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export { eveMessageInput, eveMessageTitle };
/* oxlint-enable import/no-named-export */
/* oxlint-disable import/no-named-export -- Keep the named type bindings (EveMessageInput); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export type { EveMessageInput };
/* oxlint-enable import/no-named-export */
