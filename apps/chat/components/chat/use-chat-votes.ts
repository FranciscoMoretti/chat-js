"use client";

import { useQuery } from "@tanstack/react-query";
import { useChatId } from "@/lib/stores/base";
import { useMessageIds } from "@/lib/stores/hooks-base";
import { useIsChatPersisted } from "@/lib/stores/hooks-chat-persistence";
import { useSession } from "@/providers/session-provider";
import { useTRPC } from "@/trpc/react";

export function useChatVotes(
  chatId: string,
  { isReadonly }: { isReadonly: boolean }
) {
  const trpc = useTRPC();
  const { data: session } = useSession();
  const isLoading = chatId !== useChatId();
  const isChatPersisted = useIsChatPersisted(chatId);
  const messageIds = useMessageIds() as string[];

  return useQuery({
    ...trpc.vote.getVotes.queryOptions({ chatId }),
    enabled:
      isChatPersisted &&
      messageIds.length >= 2 &&
      !isReadonly &&
      !!session?.user &&
      !isLoading,
  });
}
