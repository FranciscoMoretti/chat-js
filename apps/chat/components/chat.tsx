"use client";

import { MainChatPanel } from "@/components/chat/main-chat-panel";
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
  return (
    <MainChatPanel
      chat={chat}
      chatId={id}
      className="flex h-full min-w-0 flex-1 flex-col"
      isReadonly={isReadonly}
      projectId={projectId}
      routeSource={routeSource}
    />
  );
}
