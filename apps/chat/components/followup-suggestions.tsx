"use client";

import { PlusIcon } from "lucide-react";
import { useCallback } from "react";
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";
import type { ChatMessage, UiToolName } from "@/lib/ai/types";
import { useChatStoreApi } from "@/lib/stores/base";
import { useMessageIds } from "@/lib/stores/hooks-base";
import {
  useMessagePartByPartIdx,
  useMessagePartTypesById,
} from "@/lib/stores/hooks-message-parts";
import { cn, generateUUID } from "@/lib/utils";
import { useChatInput } from "@/providers/chat-input-provider";

function FollowUpSuggestions({
  suggestions,
  className,
}: {
  suggestions: string[];
  className?: string;
}) {
  const storeApi = useChatStoreApi();
  const { selectedModelId, selectedTool } = useChatInput();

  const handleClick = useCallback(
    (suggestion: string) => {
      const sendMessage = storeApi.getState().sendMessage;
      if (!sendMessage) {
        return;
      }

      const parentMessageId = storeApi.getState().getLastMessageId();

      const message: ChatMessage = {
        id: generateUUID(),
        role: "user",
        parts: [
          {
            type: "text",
            text: suggestion,
          },
        ],
        metadata: {
          createdAt: new Date(),
          parentMessageId,
          selectedModel: selectedModelId,
          activeStreamId: null,
          selectedTool: (selectedTool as UiToolName | null) || undefined,
        },
      };

      sendMessage(message);
    },
    [storeApi, selectedModelId, selectedTool]
  );

  if (!suggestions || suggestions.length === 0) {
    return null;
  }

  return (
    <div className={cn("mt-2 mb-2 flex flex-col gap-2", className)}>
      <div className="font-medium text-muted-foreground text-xs">Related</div>
      <Suggestions className="gap-1.5">
        {(() => {
          const seen = new Map<string, number>();
          return suggestions.map((s) => {
            const count = seen.get(s) ?? 0;
            seen.set(s, count + 1);
            const key = count === 0 ? s : `${s}-${count}`;
            return (
              <Suggestion
                className="h-7 text-muted-foreground hover:text-foreground"
                key={key}
                onClick={handleClick}
                size="sm"
                suggestion={s}
                type="button"
                variant="ghost"
              >
                {s}
                <PlusIcon className="size-3 opacity-70" />
              </Suggestion>
            );
          });
        })()}
      </Suggestions>
    </div>
  );
}

export function FollowUpSuggestionsParts({ messageId }: { messageId: string }) {
  const types = useMessagePartTypesById(messageId);
  const ids = useMessageIds();
  const isLastMessage = ids.at(-1) === messageId;

  if (!isLastMessage) {
    return null;
  }

  const partIdx = types.indexOf("data-followupSuggestions");
  if (partIdx === -1) {
    return null;
  }
  return <FollowUpSuggestionsPart messageId={messageId} partIdx={partIdx} />;
}

function FollowUpSuggestionsPart({
  messageId,
  partIdx,
}: {
  messageId: string;
  partIdx: number;
}) {
  const part = useMessagePartByPartIdx(
    messageId,
    partIdx,
    "data-followupSuggestions"
  );
  const { data } = part;

  return <FollowUpSuggestions suggestions={data.suggestions} />;
}
