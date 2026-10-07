"use client";

import { Copy, Pencil, PencilOff } from "lucide-react";
import React from "react";
import type { ReactNode } from "react";

/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import {
  MessageAction,
  MessageActions,
} from "@/components/ai-elements/message";
/* oxlint-enable sort-imports */
import { useIsMobile } from "@/hooks/use-mobile";
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (MessageActionsView); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, typescript/prefer-readonly-parameter-types -- jsdoc/require-param: the TypeScript signature describes these parameters; the prose documents behavior rather than duplicate tags; jsdoc/require-returns: the inferred or annotated return type describes the value; the prose documents behavior rather than duplicate tags; max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

/** Shared message toolbar; each runtime supplies its actions and version state. */
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
  role: string;
  isLoading?: boolean;
  isEditing?: boolean;
  editDisabled?: boolean;
  onStartEdit?: () => void;
  onCancelEdit?: () => void;
  onCopy: () => void;
  siblings?: ReactNode;
  feedback?: ReactNode;
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
/* oxlint-enable jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, typescript/prefer-readonly-parameter-types */
