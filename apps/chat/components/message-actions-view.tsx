"use client";

import { Copy, Pencil, PencilOff } from "lucide-react";
import React from "react";
import type { ReactNode } from "react";

import {
  MessageAction,
  MessageActions,
} from "@/components/ai-elements/message";
import { useIsMobile } from "@/hooks/use-mobile";
/* oxlint-disable jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, react/forbid-component-props, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types -- MessageActionsView: ; jsdoc/require-param: the TypeScript signature describes these parameters; the prose documents behavior rather than duplicate tags; jsdoc/require-returns: the inferred or annotated return type describes the value; the prose documents behavior rather than duplicate tags; max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; react/forbid-component-props: className and style are the existing Tailwind and primitive composition API; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

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
}) => {
  const isMobile = useIsMobile();
  if (isLoading) {
    return <div className="h-7" />;
  }
  const showActions = isMobile || isEditing || role === "assistant";
  return (
    <MessageActions
      className={
        showActions
          ? ""
          : "opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-hover/message:opacity-100 focus-within:opacity-100 hover:opacity-100"
      }
    >
      {role === "user" && onStartEdit && (
        <MessageAction
          className="text-muted-foreground hover:bg-accent hover:text-accent-foreground h-7 w-7 p-0"
          disabled={editDisabled}
          onClick={isEditing ? onCancelEdit : onStartEdit}
          tooltip={isEditing ? "Cancel edit" : "Edit message"}
        >
          {isEditing ? (
            <PencilOff className="h-3.5 w-3.5" />
          ) : (
            <Pencil className="h-3.5 w-3.5" />
          )}
        </MessageAction>
      )}
      {siblings}
      <MessageAction
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
/* oxlint-enable jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, react/forbid-component-props, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types */
