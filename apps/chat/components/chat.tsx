"use client";

import { ChatHeader } from "@/components/chat-header";
import { ChatContent } from "@/components/chat/chat-content";
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
import { useMessageIds } from "@/lib/stores/hooks-base";
import type { UIChat } from "@/lib/types/ui-chat";
import { useSession } from "@/providers/session-provider";

export const Chat = ({
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
}) => {
  const { data: session } = useSession();
  const hasMessages = useMessageIds().length > 0;
  const isSecondaryPanelVisible = useArtifactSelector(
    (state) => state.isVisible
  );

  return (
    <ChatLayout isSecondaryPanelVisible={isSecondaryPanelVisible}>
      <ChatLayoutMain>
        <MainChatPanel>
          <ChatHeader
            chat={chat}
            chatId={id}
            className="h-(--header-height) shrink-0"
            hasMessages={hasMessages}
            isReadonly={isReadonly}
            projectId={projectId}
            routeSource={routeSource}
            user={session?.user}
          />
          <ChatContent
            chatId={id}
            className="min-h-0 flex-1"
            isReadonly={isReadonly}
            projectId={projectId}
          />
        </MainChatPanel>
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
};
