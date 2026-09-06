import { RefreshCcw } from "lucide-react";
import { useCallback } from "react";
import { toast } from "sonner";
import { Action } from "@/components/ai-elements/actions";
import { useConversationView } from "@/components/chat/conversation-view";
import { useChatStatus } from "@/lib/chat/view-hooks";
import { getRetryMessageInput } from "@/lib/chat-tree-actions";

export function RetryButton({
  messageId,
  className,
}: {
  messageId: string;
  className?: string;
}) {
  const view = useConversationView();
  const status = useChatStatus();

  const handleRetry = useCallback(() => {
    const { regenerate } = view;
    const messages = view.thread.getPath(messageId);
    if (!regenerate) {
      toast.error("Cannot retry this message");
      return;
    }

    const retryInput = getRetryMessageInput({
      messageId,
      messages,
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

    regenerate({
      body: {
        isPrimaryParallel: retryInput.isPrimaryParallel,
        parallelGroupId: retryInput.parallelGroupId,
        parallelIndex: retryInput.parallelIndex,
        selectedModelId: retryInput.selectedModelId,
      },
      messageId,
    }).catch(() => {
      toast.error("Could not retry this message");
    });
  }, [messageId, view]);

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
