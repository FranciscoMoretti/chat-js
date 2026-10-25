import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import React from "react";
import type { JSX as ReactJSX } from "react";

import { MessageAction } from "@/components/ai-elements/message";
import { MessageVoteActions } from "./message-vote-actions";
import { useTRPC } from "@/trpc/react";

export const FeedbackActions = ({
  conversationId,
  messageId,
  disabled,
}: {
  readonly conversationId: string;
  readonly messageId: string;
  readonly disabled: boolean;
}): ReactJSX.Element => {
  const [, startEventAction] = React.useTransition();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  // All messages share one cached query and one request per conversation.
  const options = trpc.feedback.votes.queryOptions({ conversationId });
  const votes = useQuery(options);
  const mutation = useMutation(
    trpc.feedback.vote.mutationOptions({
      onMutate: async () => {
        // A background read started before this vote must not overwrite its result.
        await queryClient.cancelQueries({ queryKey: options.queryKey });
      },
      onSuccess: async (saved) => {
        // Focus/reconnect may have started another read while the save was pending.
        await queryClient.cancelQueries({ queryKey: options.queryKey });
        queryClient.setQueryData(options.queryKey, (previous) => [
          ...(previous ?? []).filter(
            (vote) => vote.messageId !== saved.messageId
          ),
          saved,
        ]);
      },
    })
  );
  if (votes.isError) {
    return (
      <MessageAction
        disabled={votes.isFetching}

        onClick={() => {
          startEventAction(async () => {
            await votes.refetch();
          });
        }}
        tooltip="Retry loading feedback"
      >
        <RefreshCw size={14} />
      </MessageAction>
    );
  }
  return (
    <MessageVoteActions
      disabled={disabled || votes.isPending || mutation.isPending}
      onVote={async (type) =>
        await mutation.mutateAsync({ conversationId, messageId, type })
      }
      vote={votes.data?.find((vote) => vote.messageId === messageId)}
    />
  );
};
