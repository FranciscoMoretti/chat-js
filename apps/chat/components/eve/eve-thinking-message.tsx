import React from "react";
import type { JSX as ReactJSX } from "react";

import { MessageScrollerItem } from "@/components/ui/message-scroller";
import { ThinkingMessage } from "@/components/thinking-message";
import type { ChatMessage, ChatMessagePart } from "@/lib/ai/chat-message";

export const EveThinkingMessage = ({
  status,
  messages,
}: {
  readonly status: string;
  readonly messages: readonly Pick<ChatMessage, "id" | "role" | "parts">[];
}): ReactJSX.Element | null => {
  if (status !== "submitted" && status !== "streaming") {
    return null;
  }
  const latest = messages.at(-1);
  // Eve opens the stream before the assistant has any visible content.
  const hasContent =
    latest?.role === "assistant" &&
    latest.parts.some((part: ChatMessagePart) => {
      if (part.type === "text") {
        return Boolean(part.text.trim());
      }
      return part.type !== "step-start";
    });
  if (status === "submitted" || !hasContent) {
    return (
      <MessageScrollerItem messageId="thinking">
        <ThinkingMessage />
      </MessageScrollerItem>
    );
  }
  return null;
};
