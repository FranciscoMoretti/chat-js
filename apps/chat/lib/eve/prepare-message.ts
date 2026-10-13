import type { ReadonlyEveMessageInput } from "./readonly-message-types";
import type { UserContent } from "ai";
import { config } from "@/lib/config";
import { downloadFile } from "@/lib/file-storage";
import { keyFromFileUrl } from "@/lib/file-url";
import { loadEveModelDefinition } from "./model-selection";

/**
 * Resolve application storage directly, never fetch a client-supplied host.
 * @param {ReadonlyEveMessageInput} message Validated user text or attachment references owned by application storage.
 * @param {string | undefined} modelId Model whose PDF/image capabilities must permit each attachment.
 * @returns {Promise<string | UserContent>} The original text, or ordered model content with checked files embedded as data URLs.
 */
export const prepareEveMessage = async (
  message: ReadonlyEveMessageInput,
  modelId?: string
): Promise<string | UserContent> => {
  if (typeof message === "string") {
    return message;
  }
  const model = await loadEveModelDefinition(modelId);
  const content: UserContent = [];
  for (const part of message) {
    if (part.type === "text") {
      content.push(part);
    } else {
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
      if (key === null || key === "") {
        throw new Error("Invalid attachment reference.");
      }
      // oxlint-disable-next-line eslint/no-await-in-loop -- Download, validate, and encode one attachment before reading the next; Promise.all would retain multiple max-size byte buffers at once.
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
        // oxlint-disable-next-line eslint/no-await-in-loop -- Download, validate, and encode one attachment before reading the next; Promise.all would retain multiple max-size byte buffers at once.
        data: `data:${file.type};base64,${Buffer.from(await file.arrayBuffer()).toString("base64")}`,
        filename: part.filename,
        mediaType: file.type,
        type: "file",
      });
    }
  }
  return content;
};
