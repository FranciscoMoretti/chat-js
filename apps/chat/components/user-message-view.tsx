"use client";

import React from "react";
import type { ReactNode } from "react";

import { Message, MessageContent } from "@/components/ai-elements/message";
import { cn } from "@/lib/utils";
/* oxlint-disable jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, no-undefined, react-perf/jsx-no-new-function-as-prop, react/forbid-component-props, react/jsx-max-depth, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions -- UserMessageView: ; jsdoc/require-param: the TypeScript signature describes these parameters; the prose documents behavior rather than duplicate tags; jsdoc/require-returns: the inferred or annotated return type describes the value; the prose documents behavior rather than duplicate tags; max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; no-undefined: undefined preserves the optional prop, cache, or missing-value contract; null is a different value; react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; react/forbid-component-props: className and style are the existing Tailwind and primitive composition API; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including event); typescript/strict-boolean-expressions: the existing empty, missing, or optional value deliberately selects this feature fallback (including editor). */

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
}): React.JSX.Element => (
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
              const selection = globalThis.getSelection();
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
/* oxlint-enable jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, no-undefined, react-perf/jsx-no-new-function-as-prop, react/forbid-component-props, react/jsx-max-depth, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */
