import { RefreshCcw } from "lucide-react";
import { useCallback } from "react";
import { toast } from "sonner";
import { Action } from "@/components/ai-elements/actions";
import type { ChatMessage } from "@/lib/ai/types";
import { getRetryMessageInput } from "@/lib/chat-tree-actions";
import {
  useChatActions,
  useChatStatus,
  useChatStoreApi,
} from "@/lib/stores/base";

export function RetryButton({
  messageId,
  className,
}: {
  messageId: string;
  className?: string;
}) {
  const { setMessages, regenerate } = useChatActions<ChatMessage>();
  const chatStore = useChatStoreApi<ChatMessage>();
  const status = useChatStatus();

  const handleRetry = useCallback(() => {
    if (!regenerate) {
      toast.error("Cannot retry this message");
      return;
    }

    const retryInput = getRetryMessageInput({
      messageId,
      messages: chatStore.getState().messages,
    });

    if (!retryInput.ok) {
      if (retryInput.reason === "message_not_found") {
        toast.error("Cannot find the message to retry");
      } else if (retryInput.reason === "parent_not_found") {
        toast.error("Cannot find the user message to retry");
      } else if (retryInput.reason === "parent_not_user") {
        toast.error("Parent message is not from user");
      } else {
        toast.error("Cannot determine which model to retry");
      }
      return;
    }

    setMessages(retryInput.messagesBeforeRetry);

    regenerate({
      body: {
        selectedModelId: retryInput.selectedModelId,
      },
      messageId,
    });

    toast.success("Retrying message...");
  }, [regenerate, messageId, setMessages, chatStore]);

  if (status === "streaming" || status === "submitted") {
    return null;
  }

  return (
    <Action
      className={`h-7 w-7 text-muted-foreground hover:bg-accent hover:text-accent-foreground p-0${
        className ? ` ${className}` : ""
      }`}
      onClick={handleRetry}
      tooltip="Retry"
    >
      <RefreshCcw className="h-3.5 w-3.5" />
    </Action>
  );
}
