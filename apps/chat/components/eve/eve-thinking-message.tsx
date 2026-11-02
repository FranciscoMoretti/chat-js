import type { EveMessage } from "eve/client";
import React from "react";
import type { JSX as ReactJSX } from "react";

import { MessageScrollerItem } from "@/components/ui/message-scroller";
import { ThinkingMessage } from "@/components/thinking-message";
import type { ReadonlyEveMessagePart } from "@/lib/eve/readonly-message-types";

export const EveThinkingMessage = ({
  status,
  messages,
}: {
  readonly status: string;
  readonly messages: readonly (Readonly<
    Omit<EveMessage, "parts" | "metadata">
  > & {
    readonly parts: readonly ReadonlyEveMessagePart[];
    readonly metadata?: unknown;
  })[];
}): ReactJSX.Element | null => {
  if (status !== "submitted" && status !== "streaming") {
    return null;
  }
  const latest = messages.at(-1);
  // Eve opens the stream before the assistant has any visible content.
  const hasContent =
    latest?.role === "assistant" &&
    latest.parts.some((part: ReadonlyEveMessagePart) => {
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
