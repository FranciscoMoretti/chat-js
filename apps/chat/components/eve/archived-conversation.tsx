"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ChatLayout,
  ChatLayoutHandle,
  ChatLayoutMain,
  ChatLayoutSecondary,
} from "@/components/chat/chat-layout";
import { SecondaryChatPanel } from "@/components/chat/secondary-chat-panel";
import { ChatHeaderView } from "@/components/chat-header";
import { ChatSystem } from "@/components/chat-system";
import { Messages } from "@/components/messages";
import { useArtifactSelector } from "@/hooks/use-artifact";
import { useChatSystemInitialState } from "@/hooks/use-chat-system-initial-state";
import type { ChatMessage } from "@/lib/ai/types";
import { createCustomChatStore } from "@/lib/stores/custom-store-provider";
import type { UIChat } from "@/lib/types/ui-chat";

function ArchivePanels() {
  const visible = useArtifactSelector((state) => state.isVisible);
  return (
    <ChatLayout isSecondaryPanelVisible={visible}>
      <ChatLayoutMain>
        <Messages className="min-h-0 flex-1" isReadonly />
      </ChatLayoutMain>
      <ChatLayoutHandle />
      <ChatLayoutSecondary>
        <SecondaryChatPanel
          className="flex h-full min-w-0 flex-1 flex-col"
          isReadonly
        />
      </ChatLayoutSecondary>
    </ChatLayout>
  );
}

export function ArchivedConversation({
  chat,
  messages,
}: {
  chat: UIChat;
  messages: ChatMessage[];
}) {
  const initial = useChatSystemInitialState(messages);
  const [store] = useState(() => {
    const snapshot = createCustomChatStore(initial.initialMessages, {
      initialTree: initial.initialTree,
      initialIsChatPersisted: true,
    });
    snapshot.setState({ id: chat.id });
    return snapshot;
  });
  return (
    <div className="flex h-dvh min-h-0 flex-col">
      <ChatHeaderView
        actions={
          <Link className="shrink-0 text-sm" href="/">
            New conversation
          </Link>
        }
        breadcrumb={
          <h1 className="ml-2 truncate font-medium text-sm">{chat.title}</h1>
        }
      />
      <p className="border-b p-3 text-muted-foreground text-sm">
        This conversation is available for reading. Continuing its history will
        be available after import support is ready.
      </p>
      <ChatSystem
        id={chat.id}
        initialMessages={initial.initialMessages}
        initialTree={initial.initialTree}
        isReadonly
        runtimeKey={`archive:${chat.id}`}
        store={store}
      >
        <ArchivePanels />
      </ChatSystem>
    </div>
  );
}
