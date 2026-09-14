import { memo } from "react";
import { toast } from "sonner";
import { useCopyToClipboard } from "usehooks-ts";

import { MessageActionsView } from "@/components/message-actions-view";
import { useChatStoreApi } from "@/lib/stores/base";
import { useMessageRoleById } from "@/lib/stores/hooks-base";

import { useChatVotes } from "./chat/use-chat-votes";
import { FeedbackActions } from "./feedback-actions";
import { MessageSiblings } from "./message-siblings";

const PureMessageActions = ({
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
}) => {
  const storeApi = useChatStoreApi();
  const [_, copyToClipboard] = useCopyToClipboard();
  const role = useMessageRoleById(messageId);

  const { data: votes } = useChatVotes(chatId, { isReadonly: isReadOnly });
  const vote = votes?.find((v) => v.messageId === messageId);

  return (
    <MessageActionsView
      isEditing={isEditing}
      isLoading={isLoading}
      onCancelEdit={onCancelEdit}
      onStartEdit={isReadOnly ? undefined : onStartEdit}
      role={role ?? "user"}
      siblings={
        <MessageSiblings isReadOnly={isReadOnly} messageId={messageId} />
      }
      feedback={
        role === "assistant" && !isReadOnly ? (
          <FeedbackActions
            chatId={chatId}
            isReadOnly={isReadOnly}
            messageId={messageId}
            vote={vote}
          />
        ) : null
      }
      onCopy={async () => {
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
    />
  );
};

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
