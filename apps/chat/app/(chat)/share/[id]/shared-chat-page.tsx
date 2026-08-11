"use client";
import { notFound } from "next/navigation";
import { ChatSystem } from "@/components/chat-system";
import { WithSkeleton } from "@/components/with-skeleton";
import { useChatSystemInitialState } from "@/hooks/use-chat-system-initial-state";
import { usePublicChat, usePublicChatMessages } from "@/hooks/use-shared-chat";

export function SharedChatPage({ id }: { id: string }) {
  const {
    data: chat,
    isLoading: isChatLoading,
    error: chatError,
  } = usePublicChat(id);
  const {
    data: messages,
    isLoading: isMessagesLoading,
    error: messagesError,
  } = usePublicChatMessages(id);

  const initialState = useChatSystemInitialState(messages);

  if (!id) {
    return notFound();
  }

  if (chatError || messagesError) {
    // TODO: Replace for error page
    return (
      <div className="flex h-dvh items-center justify-center">
        <div className="text-muted-foreground">
          This chat is not available or has been set to private
        </div>
      </div>
    );
  }

  if (!(isChatLoading || chat)) {
    return notFound();
  }

  if (isMessagesLoading || isChatLoading) {
    return (
      <WithSkeleton
        className="h-full w-full"
        isLoading={isChatLoading || isMessagesLoading}
      >
        <div className="flex h-dvh w-full" />
      </WithSkeleton>
    );
  }

  if (!chat) {
    return notFound();
  }

  return (
    <WithSkeleton
      className="w-full"
      isLoading={isChatLoading || isMessagesLoading}
    >
      <ChatSystem
        id={chat.id}
        initialMessages={initialState.initialMessages}
        initialTree={initialState.initialTree}
        isReadonly={true}
        routeSource="share"
        runtimeKey={`share:${chat.id}`}
      />
    </WithSkeleton>
  );
}
