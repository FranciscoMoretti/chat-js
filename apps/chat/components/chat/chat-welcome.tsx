"use client";

import type { UseChatHelpers } from "@ai-sdk/react";
import { memo } from "react";

import { ChatComposer } from "@/components/chat-composer";
import { SuggestedActions } from "@/components/suggested-actions";
import type { ChatMessage } from "@/lib/ai/types";
import { useLastMessageId } from "@/lib/stores/hooks-base";
import { cn } from "@/lib/utils";
import { useChatInput } from "@/providers/chat-input-provider";

const WelcomeMessage = () => (
  <div className="pointer-events-none text-center">
    <h1 className="text-foreground text-2xl font-normal sm:text-3xl">
      How can I help you today?
    </h1>
  </div>
);

const PureChatWelcome = ({
  chatId,
  status,
  className,
}: {
  chatId: string;
  status: UseChatHelpers<ChatMessage>["status"];
  className?: string;
}) => {
  const parentMessageId = useLastMessageId();
  const { selectedModelId } = useChatInput();

  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col justify-end md:justify-center",
        className
      )}
    >
      <div className="mx-auto w-full p-2 pb-4 md:max-w-3xl @[500px]:px-4 @[500px]:pb-6">
        <div className="mb-4 md:mb-6">
          <WelcomeMessage />
        </div>
        <ChatComposer
          autoFocus
          chatId={chatId}
          parentMessageId={parentMessageId}
          status={status}
        />
        <SuggestedActions
          chatId={chatId}
          className="mt-4"
          selectedModelId={selectedModelId}
        />
      </div>
    </div>
  );
};

export const ChatWelcome = memo(PureChatWelcome);
