"use client";

import { Copy, Pencil, PencilOff } from "lucide-react";
import {
  MessageAction,
  MessageActions,
} from "@/components/ai-elements/message";

import React from "react";

import type { ReadonlyReactNode } from "@/lib/readonly-react-node";

import { useIsMobile } from "@/hooks/use-mobile";

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (MessageActionsView); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable max-lines-per-function -- max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision */

/**
 * Shared message toolbar; each runtime supplies its actions and version state.
 *
 * @param {string} role Author role used to reveal the toolbar.
 * @param {boolean | undefined} isLoading Whether generation is active.
 * @param {boolean | undefined} isEditing Whether the inline editor is active.
 * @param {boolean | undefined} editDisabled Disables the edit action.
 * @param {(() => void) | undefined} onStartEdit Opens the inline editor.
 * @param {(() => void) | undefined} onCancelEdit Closes the inline editor.
 * @param {() => void} onCopy Copies the message using the runtime callback.
 * @param {ReadonlyReactNode | undefined} siblings Version navigation controls.
 * @param {ReadonlyReactNode | undefined} feedback Response feedback controls.
 * @returns {React.JSX.Element} The composed message interface.
 */
export const MessageActionsView = ({
  role,
  isLoading = false,
  isEditing = false,
  editDisabled = false,
  onStartEdit,
  onCancelEdit,
  onCopy,
  siblings,
  feedback,
}: {
  readonly role: string;
  readonly isLoading?: boolean;
  readonly isEditing?: boolean;
  readonly editDisabled?: boolean;
  readonly onStartEdit?: () => void;
  readonly onCancelEdit?: () => void;
  readonly onCopy: () => void;
  readonly siblings?: ReadonlyReactNode;
  readonly feedback?: ReadonlyReactNode;
}): React.JSX.Element => {
  const isMobile = useIsMobile();
  if (isLoading) {
    return <div className="h-7" />;
  }
  const showActions = isMobile || isEditing || role === "assistant";
  return (
    <MessageActions
      // oxlint-disable-next-line react/forbid-component-props -- MessageActions accepts className in its styling contract; preserve this caller's layout and appearance.
      className={
        // oxlint-disable-next-line no-ternary -- Keep className JSX attribute as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
        showActions
          ? ""
          : "opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-hover/message:opacity-100 focus-within:opacity-100 hover:opacity-100"
      }
    >
      {role === "user" && onStartEdit && (
        <MessageAction
          // oxlint-disable-next-line react/forbid-component-props -- MessageAction accepts className in its styling contract; preserve this caller's layout and appearance.
          className="text-muted-foreground hover:bg-accent hover:text-accent-foreground h-7 w-7 p-0"
          disabled={editDisabled}
          // oxlint-disable-next-line no-ternary -- Keep onClick JSX attribute as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
          onClick={isEditing ? onCancelEdit : onStartEdit}
          // oxlint-disable-next-line no-ternary -- Keep tooltip JSX attribute as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
          tooltip={isEditing ? "Cancel edit" : "Edit message"}
        >
          {
            // oxlint-disable-next-line no-ternary -- Keep JSX child as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
            isEditing ? (
              <PencilOff
                // oxlint-disable-next-line react/forbid-component-props -- PencilOff accepts className in its styling contract; preserve this caller's layout and appearance.
                className="h-3.5 w-3.5"
              />
            ) : (
              <Pencil
                // oxlint-disable-next-line react/forbid-component-props -- Pencil accepts className in its styling contract; preserve this caller's layout and appearance.
                className="h-3.5 w-3.5"
              />
            )
          }
        </MessageAction>
      )}
      {siblings}
      <MessageAction
        // oxlint-disable-next-line react/forbid-component-props -- MessageAction accepts className in its styling contract; preserve this caller's layout and appearance.
        className="text-muted-foreground hover:bg-accent hover:text-accent-foreground h-7 w-7 p-0"
        onClick={onCopy}
        tooltip="Copy"
      >
        <Copy size={14} />
      </MessageAction>
      {feedback}
    </MessageActions>
  );
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable max-lines-per-function */
