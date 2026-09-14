"use client";

import { Copy, Pencil, PencilOff } from "lucide-react";
import type { ReactNode } from "react";

import {
  MessageAction,
  MessageActions,
} from "@/components/ai-elements/message";
import { useIsMobile } from "@/hooks/use-mobile";

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
