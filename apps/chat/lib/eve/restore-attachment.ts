import type { EveMessagePart } from "eve/client";

import { createFileUrl, keyFromFileUrl } from "../file-url";
import { draftAttachment } from "./draft";

/** Restore exact bytes from inline native history or an owned same-origin copy. */
export const restoreEveAttachment = async (
  part: Extract<
    EveMessagePart,
    {
      type: "file";
    }
  >,
  origin: string,
  maxBytes: number
) => {
  const mediaType = draftAttachment.shape.contentType.parse(part.mediaType);
  if (!part.url) {
    throw new Error("This attachment is unavailable for editing.");
  }
  let source = part.url;
  if (!source.startsWith(`data:${mediaType};base64,`)) {
    const url = new URL(source, origin);
    const key = keyFromFileUrl(source);
    if (
      url.origin !== origin ||
      url.username ||
      url.password ||
      url.hash ||
      !key
    ) {
      throw new Error("This attachment is not an owned ChatJS file.");
    }
    source = createFileUrl(key);
  }
  const response = await fetch(source, {
    credentials: "same-origin",
    redirect: "error",
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    throw new Error("Unable to restore this attachment. Retry before editing.");
  }
  const blob = await response.blob();
  if (blob.type !== mediaType || !blob.size || blob.size > maxBytes) {
    throw new Error("This attachment has an unsupported type or size.");
  }
  return new File([blob], part.filename ?? "attachment", { type: mediaType });
};
