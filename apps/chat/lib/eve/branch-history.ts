import type { EveCopySeed } from "./copy-seed";

/** Import only model content; ownership and display metadata stay in ChatJS. */
export const nativeBranchHistory = (capture: EveCopySeed) =>
  capture.messages.map((message, index) => ({
    id: String(index),
    role: message.role,
    parts: message.parts.map((part) => {
      if (part.type !== "file") {
        return part;
      }
      return {
        type: part.type,
        url: part.url,
        mediaType: part.mediaType,
        ...(part.filename === undefined ? {} : { filename: part.filename }),
      };
    }),
  }));
