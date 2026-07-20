"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { ChatSync } from "@/components/chat-sync";
import { type AppRuntime, getAppRuntimeStore } from "@/lib/app-chat-runtime";
import { claimConfirmedProvisionalChat } from "@/lib/provisional-chat-confirmations";
import { CustomStoreProvider } from "@/lib/stores/custom-store-provider";
import { useIsChatPersisted } from "@/lib/stores/hooks-chat-persistence";
import { useTRPC } from "@/trpc/react";

function ChatConfirmationEffects({ chatId }: { chatId: string }) {
  const isChatPersisted = useIsChatPersisted(chatId);
  const queryClient = useQueryClient();
  const trpc = useTRPC();
  const handledConfirmationRef = useRef(false);

  useEffect(() => {
    if (!isChatPersisted) {
      return;
    }

    if (handledConfirmationRef.current) {
      return;
    }

    if (!claimConfirmedProvisionalChat(chatId)) {
      return;
    }

    handledConfirmationRef.current = true;

    const invalidatePersistedChatQueries = async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: trpc.chat.getChatMessages.queryKey({
            chatId,
          }),
        }),
        queryClient.invalidateQueries({
          queryKey: trpc.chat.getChatById.queryKey({
            chatId,
          }),
        }),
        queryClient.invalidateQueries({
          queryKey: trpc.chat.getAllChats.queryKey(),
          exact: false,
        }),
      ]);
    };

    invalidatePersistedChatQueries().catch(() => {
      toast.error("Failed to refresh chat history");
    });
  }, [chatId, isChatPersisted, queryClient, trpc]);

  return null;
}

export function AppRuntimeSlot({ runtime }: { runtime: AppRuntime }) {
  const store = getAppRuntimeStore(runtime);

  return (
    <CustomStoreProvider store={store}>
      <ChatConfirmationEffects chatId={runtime.data.chatId} />
      <ChatSync id={runtime.data.chatId} />
    </CustomStoreProvider>
  );
}
