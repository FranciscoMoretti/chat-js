"use client";

import type { MessageTreeSnapshot } from "@chat-js/thread";
import { memo, type ReactNode } from "react";

import { DataStreamHandler } from "@/components/data-stream-handler";
import { ArtifactProvider } from "@/hooks/use-artifact";
import type { AppModelId } from "@/lib/ai/app-models";
import type { ChatMessage, UiToolName } from "@/lib/ai/types";
import type { ApplicationThread } from "@/lib/application-thread";
import {
  type CustomChatStoreApi,
  CustomStoreProvider,
} from "@/lib/stores/custom-store-provider";
import { ChatInputProvider } from "@/providers/chat-input-provider";

export const ChatSystem = memo(function PureChatSystem({
  children,
  id,
  initialMessages,
  initialTree,
  isReadonly,
  initialTool = null,
  overrideModelId,
  projectId,
  runtimeKey,
  store,
  thread,
}: {
  children: ReactNode;
  id: string;
  initialMessages: ChatMessage[];
  initialTree?: MessageTreeSnapshot<ChatMessage>;
  isReadonly: boolean;
  initialTool?: UiToolName | null;
  overrideModelId?: AppModelId;
  projectId?: string;
  runtimeKey: string;
  store?: CustomChatStoreApi<ChatMessage>;
  thread?: ApplicationThread;
}) {
  return (
    <ArtifactProvider key={runtimeKey}>
      <CustomStoreProvider
        initialMessages={initialMessages}
        initialTree={initialTree}
        key={runtimeKey}
        store={store}
        thread={thread}
        threadId={id}
      >
        {isReadonly ? (
          children
        ) : (
          <ChatInputProvider
            initialTool={initialTool ?? null}
            isProjectContext={!!projectId}
            localStorageEnabled={true}
            overrideModelId={overrideModelId}
          >
            <DataStreamHandler key={`stream:${runtimeKey}`} />
            {children}
          </ChatInputProvider>
        )}
      </CustomStoreProvider>
    </ArtifactProvider>
  );
});
