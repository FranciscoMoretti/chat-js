import type { UIMessage } from "ai";

export const getMessageText = (message: UIMessage) =>
  message.parts.map((part) => (part.type === "text" ? part.text : "")).join("");
