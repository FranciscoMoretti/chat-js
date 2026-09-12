import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { toast } from "sonner";

import { getPrimarySelectedModelId } from "@/lib/ai/types";
import type { ChatMessage } from "@/lib/ai/types";
import type { Vote } from "@/lib/db/schema";
import { useMessageById } from "@/lib/stores/base";
import { useIsChatPersisted } from "@/lib/stores/hooks-chat-persistence";
import { useSession } from "@/providers/session-provider";
import { useTRPC } from "@/trpc/react";

import { MessageAction as Action } from "./ai-elements/message";
import { RetryButton } from "./retry-button";
import { Tag } from "./tag";

const SelectedModelId = ({ messageId }: { messageId: string }) => {
  const message = useMessageById<ChatMessage>(messageId);
  const selectedModelId = getPrimarySelectedModelId(
    message?.metadata?.selectedModel
  );

  return selectedModelId ? (
    <div className="ml-2 flex items-center">
      <Tag>{selectedModelId}</Tag>
    </div>
  ) : null;
};

export const FeedbackActions = ({
  chatId,
  messageId,
  vote,
  isReadOnly,
}: {
  chatId: string;
  messageId: string;
  vote: Vote | undefined;
  isReadOnly: boolean;
}) => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const isChatPersisted = useIsChatPersisted(chatId);

  const isAuthenticated = !!session?.user;

  const voteMessageMutation = useMutation(
    trpc.vote.voteMessage.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.vote.getVotes.queryKey({ chatId }),
        });
      },
    })
  );

  if (isReadOnly || !isAuthenticated) {
    return null;
  }

  return (
    <>
      {isChatPersisted ? (
        <>
          <Action
            className="text-muted-foreground hover:bg-accent hover:text-accent-foreground pointer-events-auto! h-7 w-7 p-0"
            data-testid="message-downvote"
            disabled={vote && !vote.isUpvoted}
            onClick={() => {
              toast.promise(
                voteMessageMutation.mutateAsync({
                  chatId,
                  messageId,
                  type: "down" as const,
                }),
                {
                  error: "Failed to downvote response.",
                  loading: "Downvoting Response...",
                  success: "Downvoted Response!",
                }
              );
            }}
            tooltip="Downvote Response"
          >
            <ThumbsDown size={14} />
          </Action>

          <Action
            className="text-muted-foreground hover:bg-accent hover:text-accent-foreground pointer-events-auto! h-7 w-7 p-0"
            data-testid="message-upvote"
            disabled={vote?.isUpvoted}
            onClick={() => {
              toast.promise(
                voteMessageMutation.mutateAsync({
                  chatId,
                  messageId,
                  type: "up" as const,
                }),
                {
                  error: "Failed to upvote response.",
                  loading: "Upvoting Response...",
                  success: "Upvoted Response!",
                }
              );
            }}
            tooltip="Upvote Response"
          >
            <ThumbsUp size={14} />
          </Action>
        </>
      ) : null}

      <RetryButton messageId={messageId} />
      <SelectedModelId messageId={messageId} />
    </>
  );
};
