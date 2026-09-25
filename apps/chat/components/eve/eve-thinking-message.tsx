import type { EveMessage } from "eve/client";

import { ThinkingMessage } from "@/components/thinking-message";

export const EveThinkingMessage = ({
  status,
  messages,
}: {
  status: string;
  messages: readonly EveMessage[];
}) => {
  if (status !== "submitted" && status !== "streaming") {
    return null;
  }
  const latest = messages.at(-1);
  // Eve opens the stream before the assistant has any visible content.
  const hasContent =
    latest?.role === "assistant" &&
    latest.parts.some((part) =>
      part.type === "text"
        ? Boolean(part.text.trim())
        : part.type !== "step-start"
    );
  return status === "submitted" || !hasContent ? <ThinkingMessage /> : null;
};
