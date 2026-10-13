"use client";

import React from "react";

import { Message, MessageContent } from "@/components/ai-elements/message";
import type { ReadonlyReactNode } from "@/lib/readonly-react-node";
import { hasCustomContent } from "@/components/custom-content";
import { cn } from "@/lib/utils";

/**
 * Inline editing and message chrome for EVE messages.
 *
 * @param {string} text Visible user message text.
 * @param {ReadonlyReactNode | undefined} attachments Attached files for this message.
 * @param {ReadonlyReactNode} actions Message action controls.
 * @param {ReadonlyReactNode | undefined} responses Additional response content below the message.
 * @param {ReadonlyReactNode | undefined} editor Inline editor content.
 * @param {(() => void) | undefined} onEdit Opens the inline editor on double click.
 * @param {boolean | undefined} editDisabled Disables inline editing.
 * @param {string | undefined} messageId Stable message identity.
 * @returns {React.JSX.Element} The composed message interface.
 */
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
  readonly text: string;
  readonly attachments?: ReadonlyReactNode;
  readonly actions: ReadonlyReactNode;
  readonly responses?: ReadonlyReactNode;
  readonly editor?: ReadonlyReactNode;
  readonly onEdit?: () => void;
  readonly editDisabled?: boolean;
  readonly messageId?: string;
}): React.JSX.Element => (
  <Message
    className={cn(
      hasCustomContent(editor) ? "max-w-full [&>div]:max-w-full" : undefined,
      "py-1"
    )}
    data-message-id={messageId}
    from="user"
  >
    <div
      className={cn(
        "flex w-full flex-col gap-2",
        !hasCustomContent(editor) && "items-end"
      )}
    >
      {!hasCustomContent(editor) && responses}
      {!hasCustomContent(editor) &&
        (onEdit ? (
          <button
            aria-disabled={editDisabled}
            className="block cursor-pointer text-left transition-opacity select-text hover:opacity-80"
            data-testid="message-content"
            onClick={(
              event: Readonly<{
                currentTarget: Readonly<Pick<HTMLButtonElement, "contains">>;
              }>
            ) => {
              if (editDisabled) {
                return;
              }
              const selection = globalThis.getSelection();
              if (
                selection !== null &&
                selection.toString() !== "" &&
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
      {hasCustomContent(editor) ? (
        <div className="flex flex-row items-start gap-2">{editor}</div>
      ) : (
        editor
      )}
      <div className="self-end">{actions}</div>
    </div>
  </Message>
);
