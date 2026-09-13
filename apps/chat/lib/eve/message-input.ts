/* oxlint-disable eslint/sort-keys -- Property order is part of persisted EVE request and transcript hashes; keep the original wire representation. */
import { z } from "zod";

import { keyFromFileUrl } from "../file-url";

const textPart = z
  .object({
    type: z.literal("text"),
    text: z.string().trim().min(1).max(16_000),
  })
  .strict();
const filePart = z
  .object({
    type: z.literal("file"),
    data: z
      .string()
      .refine(
        (value) =>
          value.startsWith("/api/files/content?") &&
          keyFromFileUrl(value) !== null,
        "Use a ChatJS upload"
      ),
    mediaType: z.enum(["image/jpeg", "image/png", "application/pdf"]),
    filename: z.string().min(1).max(255),
  })
  .strict();
export const eveMessageInput = z.union([
  z.string().trim().min(1).max(16_000),
  z
    .array(z.union([textPart, filePart]))
    .min(1)
    .max(17)
    .refine(
      (parts) =>
        parts.filter((part) => part.type === "text").length <= 1 &&
        parts.filter((part) => part.type === "file").length <= 16
    ),
]);
export type EveMessageInput = z.infer<typeof eveMessageInput>;
export const eveMessageTitle = (message: EveMessageInput) => {
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
