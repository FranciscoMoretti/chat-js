"use client";

import { useCallback } from "react";

import { FollowUpSuggestionsView } from "@/components/followup-suggestions-view";
import type { ChatMessage, UiToolName } from "@/lib/ai/types";
import { useChatStoreApi } from "@/lib/stores/base";
import { useMessageIds } from "@/lib/stores/hooks-base";
import {
  useMessagePartByPartIdx,
  useMessagePartTypesById,
} from "@/lib/stores/hooks-message-parts";
import { generateUUID } from "@/lib/utils";
import { useChatInput } from "@/providers/chat-input-provider";

const FollowUpSuggestions = ({
  suggestions,
  className,
}: {
  suggestions: string[];
  className?: string;
}) => {
  const storeApi = useChatStoreApi();
  const { selectedModelId, selectedTool } = useChatInput();

  const handleClick = useCallback(
    (suggestion: string) => {
      const { sendMessage } = storeApi.getState();
      if (!sendMessage) {
        return;
      }

      const parentMessageId = storeApi.getState().getLastMessageId();

      const message: ChatMessage = {
        id: generateUUID(),
        metadata: {
          activeStreamId: null,
          createdAt: new Date(),
          parentMessageId,
          selectedModel: selectedModelId,
          selectedTool: (selectedTool as UiToolName | null) || undefined,
        },
        parts: [
          {
            text: suggestion,
            type: "text",
          },
        ],
        role: "user",
      };

      sendMessage(message);
    },
    [storeApi, selectedModelId, selectedTool]
  );

  return (
    <FollowUpSuggestionsView
      className={className}
      onSelect={handleClick}
      suggestions={suggestions}
    />
  );
};

const FollowUpSuggestionsPart = ({
  messageId,
  partIdx,
}: {
  messageId: string;
  partIdx: number;
}) => {
  const part = useMessagePartByPartIdx(
    messageId,
    partIdx,
    "data-followupSuggestions"
  );
  const { data } = part;

  return <FollowUpSuggestions suggestions={data.suggestions} />;
};

export const FollowUpSuggestionsParts = ({
  messageId,
}: {
  messageId: string;
}) => {
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
};
