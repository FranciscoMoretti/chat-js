"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { ChatSync } from "@/components/chat-sync";
import {
  getAppRuntimeStore,
  getAppRuntimeThread,
} from "@/lib/app-chat-runtime";
import type { AppRuntime } from "@/lib/app-chat-runtime";
import { claimConfirmedProvisionalChat } from "@/lib/provisional-chat-confirmations";
import { CustomStoreProvider } from "@/lib/stores/custom-store-provider";
import { useIsChatPersisted } from "@/lib/stores/hooks-chat-persistence";
import { useTRPC } from "@/trpc/react";

const ChatConfirmationEffects = ({ chatId }: { chatId: string }) => {
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
          exact: false,
          queryKey: trpc.chat.getAllChats.queryKey(),
        }),
      ]);
    };

    const invalidation = invalidatePersistedChatQueries();
    void (async () => {
      try {
        await invalidation;
      } catch {
        toast.error("Failed to refresh chat history");
      }
    })();
  }, [chatId, isChatPersisted, queryClient, trpc]);

  return null;
};

export const AppRuntimeSlot = ({ runtime }: { runtime: AppRuntime }) => {
  const store = getAppRuntimeStore(runtime);
  const thread = getAppRuntimeThread(runtime);

  return (
    <CustomStoreProvider store={store} thread={thread}>
      <ChatConfirmationEffects chatId={runtime.data.chatId} />
      <ChatSync id={runtime.data.chatId} thread={thread} />
    </CustomStoreProvider>
  );
};
