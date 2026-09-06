"use client";

import {
  ChatLayout,
  ChatLayoutHandle,
  ChatLayoutMain,
  ChatLayoutSecondary,
} from "@/components/chat/chat-layout";
import { MainChatPanel } from "@/components/chat/main-chat-panel";
import { SecondaryChatPanel } from "@/components/chat/secondary-chat-panel";
import { useArtifactSelector } from "@/hooks/use-artifact";
import type { ChatRouteSource } from "@/lib/chat-route";
import type { UIChat } from "@/lib/types/ui-chat";

export function Chat({
  chat,
  id,
  isReadonly,
  projectId,
  routeSource,
}: {
  chat?: UIChat | null;
  id: string;
  isReadonly: boolean;
  projectId?: string;
  routeSource: ChatRouteSource;
}) {
  const isSecondaryPanelVisible = useArtifactSelector(
    (state) => state.isVisible
  );

  return (
    <ChatLayout isSecondaryPanelVisible={isSecondaryPanelVisible}>
      <ChatLayoutMain>
        <MainChatPanel
          chat={chat}
          chatId={id}
          className="flex h-full min-w-0 flex-1 flex-col"
          isReadonly={isReadonly}
          projectId={projectId}
          routeSource={routeSource}
        />
      </ChatLayoutMain>

      <ChatLayoutHandle />

      <ChatLayoutSecondary>
        <SecondaryChatPanel
          className="flex h-full min-w-0 flex-1 flex-col"
          isReadonly={isReadonly}
        />
      </ChatLayoutSecondary>
    </ChatLayout>
  );
}
