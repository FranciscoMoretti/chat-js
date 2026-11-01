"use client";

import { Copy, Pencil, PencilOff } from "lucide-react";
import { MessageAction } from "@/components/message-action";
import { cn } from "@/lib/utils";

import React from "react";

import type { ReadonlyReactNode } from "@/lib/readonly-react-node";

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
  if (isLoading) {
    return <div className="h-7" />;
  }
  const showActions = isEditing || role === "assistant";
  return (
    <div
      className={cn(
        "flex items-center gap-1",
        !showActions &&
          "transition-opacity group-hover/message:opacity-100 focus-within:opacity-100 hover:opacity-100 md:opacity-0"
      )}
    >
      {role === "user" && onStartEdit && (
        <MessageAction
          disabled={editDisabled}
          onClick={isEditing ? onCancelEdit : onStartEdit}
          tooltip={isEditing ? "Cancel edit" : "Edit message"}
        >
          {isEditing ? <PencilOff /> : <Pencil />}
        </MessageAction>
      )}
      {siblings}
      <MessageAction onClick={onCopy} tooltip="Copy">
        <Copy />
      </MessageAction>
      {feedback}
    </div>
  );
};
