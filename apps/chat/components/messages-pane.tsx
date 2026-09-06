"use client";
import type { UseChatHelpers } from "@ai-sdk/react";
import { memo } from "react";
import { CloneChatButton } from "@/components/clone-chat-button";
import type { ChatMessage } from "@/lib/ai/types";
import { useLastMessageId } from "@/lib/stores/hooks-base";
import { cn } from "@/lib/utils";
import { ChatComposer } from "./chat-composer";
import { Messages } from "./messages";

interface MessagesPaneProps {
  chatId: string;
  className?: string;
  isReadonly: boolean;
  status: UseChatHelpers<ChatMessage>["status"];
}

function PureMessagesPane({
  chatId,
  status,
  isReadonly,
  className,
}: MessagesPaneProps) {
  const parentMessageId = useLastMessageId();

  return (
    <div
      className={cn("flex h-full min-h-0 w-full flex-1 flex-col", className)}
    >
      <Messages className="h-full min-h-0 flex-1" isReadonly={isReadonly} />

      <div className="relative @[500px]:bottom-4 z-10 w-full shrink-0">
        {isReadonly ? (
          <CloneChatButton chatId={chatId} className="w-full" />
        ) : (
          <div className="mx-auto w-full p-2 @[500px]:px-4 @[500px]:pb-4 md:max-w-3xl @[500px]:md:pb-6">
            <ChatComposer
              chatId={chatId}
              parentMessageId={parentMessageId}
              status={status}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export const MessagesPane = memo(PureMessagesPane);
