"use client";

import React from "react";

/* oxlint-disable sort-imports -- Preserve the existing runtime import sequence and native named bindings; the enabled comparator also orders type declarations among these imports. */
import { Message, MessageContent } from "@/components/ai-elements/message";
import type { ReadonlyReactNode } from "@/lib/readonly-react-node";
/* oxlint-enable sort-imports */
import { cn } from "@/lib/utils";

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (UserMessageView); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable max-lines-per-function, no-undefined, react/jsx-max-depth, typescript/strict-boolean-expressions -- UserMessageView: max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; no-undefined: undefined preserves the optional prop, cache, or missing-value contract; null is a different value; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; typescript/strict-boolean-expressions: editor is rendered ReactNode content; its established truthiness controls editing chrome and preserves the original false, null, undefined, empty string or zero child. A non-null presence predicate changes those branches. */

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
    // oxlint-disable-next-line react/forbid-component-props, no-ternary -- Message accepts className in its styling contract; preserve this caller's layout and appearance.; no-ternary: Keep cn argument as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
    className={cn(editor ? "max-w-full [&>div]:max-w-full" : undefined, "py-1")}
    data-message-id={messageId}
    from="user"
  >
    <div className={cn("flex w-full flex-col gap-2", !editor && "items-end")}>
      {!editor && responses}
      {!editor &&
        /* oxlint-disable no-ternary -- Keep && operand as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary. */ (onEdit /* oxlint-enable no-ternary */ ? (
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
              // oxlint-disable-next-line react/forbid-component-props -- MessageContent accepts className in its styling contract; preserve this caller's layout and appearance.
              className="group-[.is-user]:bg-card text-left group-[.is-user]:max-w-none"
              data-testid="message-content"
            >
              {attachments}
              <pre className="font-sans whitespace-pre-wrap">{text}</pre>
            </MessageContent>
          </button>
        ) : (
          <MessageContent
            // oxlint-disable-next-line react/forbid-component-props -- MessageContent accepts className in its styling contract; preserve this caller's layout and appearance.
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
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable max-lines-per-function, no-undefined, react/jsx-max-depth, typescript/strict-boolean-expressions */
