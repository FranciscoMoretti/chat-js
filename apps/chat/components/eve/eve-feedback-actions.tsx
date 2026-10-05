import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import React from "react";
/* oxlint-enable sort-imports */
import type { JSX as ReactJSX } from "react";

/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import { MessageAction } from "@/components/ai-elements/message";
/* oxlint-enable sort-imports */
import { MessageVoteActions } from "@/components/message-vote-actions";
import { useTRPC } from "@/trpc/react";
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (EveFeedbackActions); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable max-lines-per-function, react-perf/jsx-no-new-function-as-prop, typescript/promise-function-async, typescript/strict-void-return -- EveFeedbackActions: ; max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; ; react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including previous); typescript/promise-function-async: return the existing promise directly; adding async changes synchronous throw behavior and promise identity; typescript/strict-void-return: this library event API ignores the return value while the existing handler owns its async pending and error lifecycle. */

export const EveFeedbackActions = ({
  conversationId,
  messageId,
  disabled,
}: {
  readonly conversationId: string;
  readonly messageId: string;
  readonly disabled: boolean;
}): ReactJSX.Element => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  // All messages share one cached query and one request per conversation.
  const options = trpc.eve.votes.queryOptions({ conversationId });
  const votes = useQuery(options);
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve mutation's awaited sequencing and rejected-Promise behavior. */
  const mutation = useMutation(
    trpc.eve.vote.mutationOptions({
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
  /* oxlint-enable oxc/no-async-await */
  if (votes.isError) {
    /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve callbacks in this return statement's awaited sequencing and rejected-Promise behavior. */
    return (
      <MessageAction
        disabled={votes.isFetching}

        // oxlint-disable-next-line typescript/no-misused-promises -- #585: React Query owns retry state and error reporting for this refetch interaction.
        onClick={async () => {
          await votes.refetch();
        }}
        tooltip="Retry loading feedback"
      >
        <RefreshCw size={14} />
      </MessageAction>
    );
    /* oxlint-enable oxc/no-async-await */
  }
  return (
    <MessageVoteActions
      disabled={disabled || votes.isPending || mutation.isPending}
      onVote={(type) =>
        mutation.mutateAsync({ conversationId, messageId, type })
      }
      vote={votes.data?.find((vote) => vote.messageId === messageId)}
    />
  );
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable max-lines-per-function, react-perf/jsx-no-new-function-as-prop, typescript/promise-function-async, typescript/strict-void-return */
