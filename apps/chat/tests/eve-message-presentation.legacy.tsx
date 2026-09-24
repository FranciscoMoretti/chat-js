import { Copy, Pencil, PencilOff } from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";

import {
  Message,
  MessageAction,
  MessageActions,
  MessageContent,
} from "../components/ai-elements/message";
import { useIsMobile } from "../hooks/use-mobile";
import { cn } from "../lib/utils";

/**
 * Frozen presentation reference from main commit
 * 4584f093835f1667c010c8fc20c502fa3f2bde41.
 *
 * The original UserMessage reads its message and controls from the legacy
 * store. This adapter keeps the original JSX/classes and replaces those
 * stores with fixture props so the parity test stays offline and deterministic.
 */
export const LegacyMessageActionsReference = ({
  isEditing,
  isLoading,
  isReadonly,
  onCancelEdit,
  onStartEdit,
  siblings,
}: {
  isEditing: boolean;
  isLoading: boolean;
  isReadonly: boolean;
  onCancelEdit?: () => void;
  onStartEdit?: () => void;
  siblings?: ReactNode;
}) => {
  const isMobile = useIsMobile();
  if (isLoading) {
    return <div className="h-7" />;
  }
  const showActionsWithoutHover = isMobile || isEditing;
  return (
    <MessageActions
      className={
        showActionsWithoutHover
          ? ""
          : "opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-hover/message:opacity-100 focus-within:opacity-100 hover:opacity-100"
      }
    >
      {!isReadonly &&
        (isEditing ? (
          <MessageAction
            className="text-muted-foreground hover:bg-accent hover:text-accent-foreground h-7 w-7 p-0"
            onClick={onCancelEdit}
            tooltip="Cancel edit"
          >
            <PencilOff className="h-3.5 w-3.5" />
          </MessageAction>
        ) : (
          <MessageAction
            className="text-muted-foreground hover:bg-accent hover:text-accent-foreground h-7 w-7 p-0"
            onClick={onStartEdit}
            tooltip="Edit message"
          >
            <Pencil className="h-3.5 w-3.5" />
          </MessageAction>
        ))}
      {siblings}
      <MessageAction
        className="text-muted-foreground hover:bg-accent hover:text-accent-foreground h-7 w-7 p-0"
        tooltip="Copy"
      >
        <Copy size={14} />
      </MessageAction>
    </MessageActions>
  );
};

/** Frozen UserMessage layout with provider-backed dependencies adapted to props. */
export const LegacyUserMessageReference = ({
  editor,
  isLoading,
  isReadonly,
  messageId,
  responses,
  siblings,
  text,
}: {
  editor?: ReactNode;
  isLoading: boolean;
  isReadonly: boolean;
  messageId: string;
  responses?: ReactNode;
  siblings?: ReactNode;
  text: string;
}) => {
  const [mode, setMode] = useState<"view" | "edit">("view");
  return (
    <Message
      className={cn(
        mode === "edit" ? "max-w-full [&>div]:max-w-full" : undefined,
        "py-1"
      )}
      data-message-id={messageId}
      data-testid="legacy-user-message"
      from="user"
    >
      <div
        className={cn(
          "flex w-full flex-col gap-2",
          mode !== "edit" && "items-end"
        )}
      >
        {mode === "view" && responses}
        {mode === "view" && isReadonly && (
          <MessageContent
            className="group-[.is-user]:bg-card text-left"
            data-testid="legacy-message-content"
          >
            <pre className="font-sans whitespace-pre-wrap">{text}</pre>
          </MessageContent>
        )}
        {mode === "view" && !isReadonly && (
          <button
            aria-label={text}
            className="block cursor-pointer text-left transition-opacity select-text hover:opacity-80"
            data-testid="legacy-message-content"
            onClick={(event) => {
              const selection = window.getSelection();
              if (
                selection?.toString() &&
                event.currentTarget.contains(selection.anchorNode)
              ) {
                return;
              }
              setMode("edit");
            }}
            type="button"
          >
            <MessageContent
              className="group-[.is-user]:bg-card text-left group-[.is-user]:max-w-none"
              data-testid="legacy-message-content"
            >
              <pre className="font-sans whitespace-pre-wrap">{text}</pre>
            </MessageContent>
          </button>
        )}
        {mode !== "view" && (
          <div className="flex flex-row items-start gap-2">{editor}</div>
        )}
        <div className="self-end">
          <LegacyMessageActionsReference
            isEditing={mode === "edit"}
            isLoading={isLoading}
            isReadonly={isReadonly}
            onCancelEdit={() => setMode("view")}
            onStartEdit={() => setMode("edit")}
            siblings={siblings}
          />
        </div>
      </div>
    </Message>
  );
};
