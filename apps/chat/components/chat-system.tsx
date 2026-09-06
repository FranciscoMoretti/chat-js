"use client";

import type { MessageTreeSnapshot } from "@chat-js/thread";
import { memo } from "react";
import { Chat } from "@/components/chat";
import { ConversationView } from "@/components/chat/conversation-view";
import { DataStreamHandler } from "@/components/data-stream-handler";
import type { AppModelId } from "@/lib/ai/app-models";
import type { ChatMessage, UiToolName } from "@/lib/ai/types";
import type { ApplicationThread } from "@/lib/application-thread";
import type { ChatRouteSource } from "@/lib/chat-route";
import {
  type CustomChatStoreApi,
  CustomStoreProvider,
} from "@/lib/stores/custom-store-provider";
import type { UIChat } from "@/lib/types/ui-chat";
import { ChatInputProvider } from "@/providers/chat-input-provider";

export const ChatSystem = memo(function PureChatSystem({
  chat,
  id,
  initialMessages,
  initialTree,
  isReadonly,
  initialTool = null,
  overrideModelId,
  projectId,
  routeSource = projectId ? "project" : "chat",
  runtimeKey,
  store,
  thread,
  viewId = "main",
  draftScope = id,
}: {
  viewId?: string;
  draftScope?: string;
  chat?: UIChat | null;
  id: string;
  initialMessages: ChatMessage[];
  initialTree?: MessageTreeSnapshot<ChatMessage>;
  isReadonly: boolean;
  initialTool?: UiToolName | null;
  overrideModelId?: AppModelId;
  projectId?: string;
  routeSource?: ChatRouteSource;
  runtimeKey: string;
  store?: CustomChatStoreApi<ChatMessage>;
  thread?: ApplicationThread;
}) {
  return (
    <CustomStoreProvider
      initialMessages={initialMessages}
      initialTree={initialTree}
      key={runtimeKey}
      store={store}
      thread={thread}
      threadId={id}
    >
      <ConversationView id={viewId}>
        {isReadonly ? (
          <Chat
            chat={chat}
            id={id}
            isReadonly={isReadonly}
            key={runtimeKey}
            projectId={projectId}
            routeSource={routeSource}
          />
        ) : (
          <ChatInputProvider
            initialTool={initialTool ?? null}
            isProjectContext={!!projectId}
            localStorageEnabled={true}
            overrideModelId={overrideModelId}
            storageKey={JSON.stringify([draftScope, viewId])}
          >
            <DataStreamHandler key={`stream:${runtimeKey}`} />
            <Chat
              chat={chat}
              id={id}
              isReadonly={isReadonly}
              key={runtimeKey}
              projectId={projectId}
              routeSource={routeSource}
            />
          </ChatInputProvider>
        )}
      </ConversationView>
    </CustomStoreProvider>
  );
});
