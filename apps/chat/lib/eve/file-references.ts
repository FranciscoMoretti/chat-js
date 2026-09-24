import { keyFromFileUrl } from "../file-url";
import type { EveMessageInput } from "./message-input";

export const eveMessageFileKeys = (message: EveMessageInput) => {
  if (typeof message === "string") {
    return [];
  }
  return message.flatMap((part) => {
    if (part.type === "text") {
      return [];
    }
    const key = keyFromFileUrl(part.data);
    if (!key) {
      throw new Error("Invalid attachment reference.");
    }
    return [key];
  });
};
