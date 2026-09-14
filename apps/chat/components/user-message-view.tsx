"use client";

import type { ReactNode } from "react";

import { Message, MessageContent } from "@/components/ai-elements/message";
import { cn } from "@/lib/utils";

/** Inline editing and message chrome shared by the legacy and EVE controllers. */
export const UserMessageView = ({
  text,
  attachments,
  actions,
  responses,
  editor,
  onEdit,
  editDisabled = false,
  messageId,
}: {
  text: string;
  attachments?: ReactNode;
  actions: ReactNode;
  responses?: ReactNode;
  editor?: ReactNode;
  onEdit?: () => void;
  editDisabled?: boolean;
  messageId?: string;
}) => (
  <Message
    className={cn(editor ? "max-w-full [&>div]:max-w-full" : undefined, "py-1")}
    data-message-id={messageId}
    from="user"
  >
    <div className={cn("flex w-full flex-col gap-2", !editor && "items-end")}>
      {!editor && responses}
      {!editor &&
        (onEdit ? (
          <button
            aria-disabled={editDisabled}
            className="block cursor-pointer text-left transition-opacity select-text hover:opacity-80"
            data-testid="message-content"
            onClick={(event) => {
              if (editDisabled) {
                return;
              }
              const selection = window.getSelection();
              if (
                selection?.toString() &&
                event.currentTarget.contains(selection.anchorNode)
              ) {
                return;
              }
              onEdit();
            }}
            type="button"
          >
            <MessageContent
              className="group-[.is-user]:bg-card text-left group-[.is-user]:max-w-none"
              data-testid="message-content"
            >
              {attachments}
              <pre className="font-sans whitespace-pre-wrap">{text}</pre>
            </MessageContent>
          </button>
        ) : (
          <MessageContent
            className="group-[.is-user]:bg-card text-left"
            data-testid="message-content"
          >
            {attachments}
            <pre className="font-sans whitespace-pre-wrap">{text}</pre>
          </MessageContent>
        ))}
      {editor && (
        <div className="flex flex-row items-start gap-2">{editor}</div>
      )}
      <div className="self-end">{actions}</div>
    </div>
  </Message>
);
