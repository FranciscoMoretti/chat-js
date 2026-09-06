"use client";

import { memo } from "react";
import { MessagesPane } from "@/components/messages-pane";
import { ProjectHome } from "@/components/project-home";
import { useChatStatus } from "@/lib/stores/base";
import { useMessageIds } from "@/lib/stores/hooks-base";
import { cn } from "@/lib/utils";
import { ChatWelcome } from "./chat-welcome";

function PureChatContent({
  chatId,
  className,
  projectId,
  isReadonly,
}: {
  chatId: string;
  className?: string;
  projectId?: string;
  isReadonly: boolean;
}) {
  const status = useChatStatus();
  const messageIds = useMessageIds() as string[];
  const hasMessages = messageIds.length > 0;

  // Project context: switch between ProjectHome and MessagesPane
  if (projectId) {
    return hasMessages ? (
      <MessagesPane
        chatId={chatId}
        className={cn("bg-background", className)}
        isReadonly={isReadonly}
        status={status}
      />
    ) : (
      <ProjectHome
        chatId={chatId}
        className={cn("h-full", className)}
        projectId={projectId}
        status={status}
      />
    );
  }

  // Non-project: keep both mounted, toggle visibility with CSS
  return (
    <>
      <ChatWelcome
        chatId={chatId}
        className={cn(className, hasMessages && "hidden")}
        status={status}
      />
      <MessagesPane
        chatId={chatId}
        className={cn("bg-background", className, !hasMessages && "hidden")}
        isReadonly={isReadonly}
        status={status}
      />
    </>
  );
}

export const ChatContent = memo(PureChatContent);
