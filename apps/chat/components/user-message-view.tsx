"use client";

import React from "react";
import type { ReactNode } from "react";

/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import { Message, MessageContent } from "@/components/ai-elements/message";
/* oxlint-enable sort-imports */
import { cn } from "@/lib/utils";
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (UserMessageView); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, no-undefined, react/jsx-max-depth, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions -- UserMessageView: ; jsdoc/require-param: the TypeScript signature describes these parameters; the prose documents behavior rather than duplicate tags; jsdoc/require-returns: the inferred or annotated return type describes the value; the prose documents behavior rather than duplicate tags; max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; no-undefined: undefined preserves the optional prop, cache, or missing-value contract; null is a different value; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including event); typescript/strict-boolean-expressions: the existing empty, missing, or optional value deliberately selects this feature fallback (including editor). */

/** Inline editing and message chrome for EVE messages. */
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
            onClick={(event) => {
              if (editDisabled) {
                return;
              }
              const selection = globalThis.getSelection();
              if (
                // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading toString from selection; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
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
/* oxlint-enable jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, no-undefined, react/jsx-max-depth, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */
