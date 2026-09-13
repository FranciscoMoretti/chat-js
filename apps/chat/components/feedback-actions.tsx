import { useMutation, useQueryClient } from "@tanstack/react-query";

import { type ChatMessage, getPrimarySelectedModelId } from "@/lib/ai/types";
import type { Vote } from "@/lib/db/schema";
import { useMessageById } from "@/lib/stores/base";
import { useIsChatPersisted } from "@/lib/stores/hooks-chat-persistence";
import { useSession } from "@/providers/session-provider";
import { useTRPC } from "@/trpc/react";

import { MessageVoteActions } from "./message-vote-actions";
import { RetryButton } from "./retry-button";
import { Tag } from "./tag";

export function FeedbackActions({
  chatId,
  messageId,
  vote,
  isReadOnly,
}: {
  chatId: string;
  messageId: string;
  vote: Vote | undefined;
  isReadOnly: boolean;
}) {
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
      {isChatPersisted && (
        <MessageVoteActions
          disabled={voteMessageMutation.isPending}
          onVote={(type) =>
            voteMessageMutation.mutateAsync({ chatId, messageId, type })
          }
          vote={vote}
        />
      )}

      <RetryButton messageId={messageId} />
      <SelectedModelId messageId={messageId} />
    </>
  );
}

function SelectedModelId({ messageId }: { messageId: string }) {
  const message = useMessageById<ChatMessage>(messageId);
  const selectedModelId = getPrimarySelectedModelId(
    message?.metadata?.selectedModel
  );

  return selectedModelId ? (
    <div className="ml-2 flex items-center">
      <Tag>{selectedModelId}</Tag>
    </div>
  ) : null;
}
