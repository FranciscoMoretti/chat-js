"use client";

import React from "react";
import { EditableBubble } from "./editable-bubble";

import {
  Message,
  MessageContent,
  MessageFooter,
} from "@/components/ui/message";
import { ChatMessageView } from "./chat-message-view";
import { Bubble } from "@/components/ui/bubble";
import type { ReadonlyReactNode } from "@/lib/readonly-react-node";
import { hasCustomContent } from "@/components/custom-content";

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
  <ChatMessageView
    author="user"
    primitives={{ Message, MessageContent }}
    messageId={messageId}
    actions={<MessageFooter>{actions}</MessageFooter>}
  >
    {!hasCustomContent(editor) && responses}
    {!hasCustomContent(editor) && hasCustomContent(attachments) && (
      <div className="max-w-full self-end">{attachments}</div>
    )}
    {!hasCustomContent(editor) && text && (
      <Bubble align="end" variant="muted">
        <EditableBubble
          button={
            onEdit
              ? {
                  "aria-disabled": editDisabled,
                  "aria-label": text,
                  className: "cursor-pointer select-text",
                  onClick: (event) => {
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
                  },
                  type: "button",
                }
              : undefined
          }
        >
          <pre className="font-sans whitespace-pre-wrap">{text}</pre>
        </EditableBubble>
      </Bubble>
    )}
    {hasCustomContent(editor) ? <div className="w-full">{editor}</div> : editor}
  </ChatMessageView>
);
