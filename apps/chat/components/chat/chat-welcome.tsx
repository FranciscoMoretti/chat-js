"use client";

import type { UseChatHelpers } from "@ai-sdk/react";
import { memo } from "react";
import { MultimodalInput } from "@/components/multimodal-input";
import { SuggestedActions } from "@/components/suggested-actions";
import type { ChatMessage } from "@/lib/ai/types";
import { useLastMessageId } from "@/lib/stores/hooks-base";
import { cn } from "@/lib/utils";
import { useChatInput } from "@/providers/chat-input-provider";

function WelcomeMessage() {
  return (
    <div className="pointer-events-none text-center">
      <h1 className="font-normal text-2xl text-foreground sm:text-3xl">
        How can I help you today?
      </h1>
    </div>
  );
}

function PureChatWelcome({
  chatId,
  status,
  className,
}: {
  chatId: string;
  status: UseChatHelpers<ChatMessage>["status"];
  className?: string;
}) {
  const parentMessageId = useLastMessageId();
  const { selectedModelId } = useChatInput();

  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col items-center justify-center",
        className
      )}
    >
      <div className="mx-auto w-full p-2 @[500px]:px-4 md:max-w-3xl">
        <div className="mb-6">
          <WelcomeMessage />
        </div>
        <MultimodalInput
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
}

export const ChatWelcome = memo(PureChatWelcome);
