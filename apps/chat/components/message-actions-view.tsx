"use client";

import { Copy, Pencil, PencilOff } from "lucide-react";
import {
  MessageAction,
  MessageActions,
} from "@/components/ai-elements/message";

import React from "react";

import type { ReadonlyReactNode } from "@/lib/readonly-react-node";

import { useIsMobile } from "@/hooks/use-mobile";

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
          tooltip={
            isEditing ? "Cancel edit" : "Copy conversation with edited prompt"
          }
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
