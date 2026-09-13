import type { UserContent } from "ai";

import { config } from "../config";
import { downloadFile } from "../file-storage";
import { keyFromFileUrl } from "../file-url";
import type { EveMessageInput } from "./message-input";
import { loadEveModelDefinition } from "./model-selection";

/** Resolve application storage directly, never fetch a client-supplied host. */
export async function prepareEveMessage(
  message: EveMessageInput,
  modelId?: string
): Promise<string | UserContent> {
  if (typeof message === "string") {
    return message;
  }
  const model = await loadEveModelDefinition(modelId);
  const content: UserContent = [];
  for (const part of message) {
    if (part.type === "text") {
      content.push(part);
      continue;
    }
    if (!config.features.attachments) {
      throw new Error("Attachments are disabled.");
    }
    const supported =
      part.mediaType === "application/pdf"
        ? model.input.pdf
        : model.input.image;
    if (!supported) {
      throw new Error(
        "The selected model does not support this attachment type."
      );
    }
    const key = keyFromFileUrl(part.data);
    if (!key) {
      throw new Error("Invalid attachment reference.");
    }
    const file = await downloadFile(key);
    if (
      file.size > config.attachments.maxBytes ||
      file.type !== part.mediaType
    ) {
      throw new Error(
        "The attachment has an unsupported size or content type."
      );
    }
    content.push({
      type: "file",
      filename: part.filename,
      mediaType: file.type,
      data: `data:${file.type};base64,${Buffer.from(await file.arrayBuffer()).toString("base64")}`,
    });
  }
  return content;
}
