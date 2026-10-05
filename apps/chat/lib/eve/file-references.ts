import { keyFromFileUrl } from "@/lib/file-url";

/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { EveMessageInput } from "./message-input";
/* oxlint-enable sort-imports */

export const eveMessageFileKeys = (
  message:
    | string
    | readonly Readonly<Exclude<EveMessageInput, string>[number]>[]
): string[] => {
  if (typeof message === "string") {
    return [];
  }
  return message.flatMap((part) => {
    if (part.type === "text") {
      return [];
    }
    const key = keyFromFileUrl(part.data);
    if (key === null || key === "") {
      throw new Error("Invalid attachment reference.");
    }
    return [key];
  });
};
