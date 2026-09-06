import { Copy, Pencil, PencilOff } from "lucide-react";
import { memo } from "react";
import { toast } from "sonner";
import { useCopyToClipboard } from "usehooks-ts";
import {
  MessageAction as Action,
  MessageActions as Actions,
} from "@/components/ai-elements/message";
import { useIsMobile } from "@/hooks/use-mobile";
import { useChatStoreApi } from "@/lib/stores/base";
import { useMessageRoleById } from "@/lib/stores/hooks-base";
import { useChatVotes } from "./chat/use-chat-votes";
import { FeedbackActions } from "./feedback-actions";
import { MessageSiblings } from "./message-siblings";

function PureMessageActions({
  chatId,
  messageId,
  isLoading,
  isReadOnly,
  isEditing,
  onStartEdit,
  onCancelEdit,
}: {
  chatId: string;
  messageId: string;
  isLoading: boolean;
  isReadOnly: boolean;
  isEditing?: boolean;
  onStartEdit?: () => void;
  onCancelEdit?: () => void;
}) {
  const storeApi = useChatStoreApi();
  const [_, copyToClipboard] = useCopyToClipboard();
  const role = useMessageRoleById(messageId);

  const isMobile = useIsMobile();

  const { data: votes } = useChatVotes(chatId, { isReadonly: isReadOnly });
  const vote = votes?.find((v) => v.messageId === messageId);

  // Version selector and model tag handled by MessageVersionAndModel component

  if (isLoading) {
    return <div className="h-7" />;
  }

  const showActionsWithoutHover = isMobile || isEditing || role === "assistant";
  return (
    <Actions
      className={
        showActionsWithoutHover
          ? ""
          : "opacity-0 transition-opacity duration-150 focus-within:opacity-100 hover:opacity-100 group-hover/message:opacity-100 group-hover:opacity-100"
      }
    >
      {role === "user" &&
        !isReadOnly &&
        (isEditing ? (
          <Action
            className="h-7 w-7 p-0 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            onClick={() => onCancelEdit?.()}
            tooltip="Cancel edit"
          >
            <PencilOff className="h-3.5 w-3.5" />
          </Action>
        ) : (
          <Action
            className="h-7 w-7 p-0 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            onClick={() => onStartEdit?.()}
            tooltip="Edit message"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Action>
        ))}

      <MessageSiblings isReadOnly={isReadOnly} messageId={messageId} />

      <Action
        className="h-7 w-7 p-0 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        onClick={async () => {
          const message = storeApi
            .getState()
            .messages.find((m) => m.id === messageId);
          if (!message) {
            return;
          }

          const textFromParts = message.parts
            ?.filter((part) => part.type === "text")
            .map((part) => part.text)
            .join("\n")
            .trim();

          if (!textFromParts) {
            toast.error("There's no text to copy!");
            return;
          }

          await copyToClipboard(textFromParts);
          toast.success("Copied to clipboard!");
        }}
        tooltip="Copy"
      >
        <Copy size={14} />
      </Action>

      {role === "assistant" && !isReadOnly && (
        <FeedbackActions
          chatId={chatId}
          isReadOnly={isReadOnly}
          messageId={messageId}
          vote={vote}
        />
      )}
    </Actions>
  );
}

export const MessageActions = memo(
  PureMessageActions,
  (prevProps, nextProps) => {
    if (prevProps.chatId !== nextProps.chatId) {
      return false;
    }
    if (prevProps.messageId !== nextProps.messageId) {
      return false;
    }
    if (prevProps.isLoading !== nextProps.isLoading) {
      return false;
    }
    if (prevProps.isReadOnly !== nextProps.isReadOnly) {
      return false;
    }
    if (prevProps.isEditing !== nextProps.isEditing) {
      return false;
    }
    if (prevProps.onStartEdit !== nextProps.onStartEdit) {
      return false;
    }
    if (prevProps.onCancelEdit !== nextProps.onCancelEdit) {
      return false;
    }

    return true;
  }
);
