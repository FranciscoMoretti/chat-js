import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "@/trpc/react";

export const usePublicChat = (
  chatId: string,
  { enabled }: { enabled?: boolean } = {}
) => {
  const trpc = useTRPC();

  return useQuery({
    ...trpc.chat.getPublicChat.queryOptions({ chatId }),
    enabled: enabled ?? true,
  });
};

export const usePublicChatMessages = (chatId: string) => {
  const trpc = useTRPC();

  return useQuery({
    ...trpc.chat.getPublicChatMessages.queryOptions({ chatId }),
    enabled: !!chatId,
  });
};
