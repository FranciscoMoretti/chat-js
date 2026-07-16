"use client";

import { useEffect, useRef } from "react";
import type { ChatMessage } from "@/lib/ai/types";
import { useChatActions } from "@/lib/stores/base";
import { useCustomChatStoreApi } from "@/lib/stores/custom-store-provider";
import { useDataStream } from "@/lib/stores/hooks-data-stream";

export function mergeCompletedMessageIntoVisiblePath(
  currentMessages: ChatMessage[],
  message: ChatMessage
): ChatMessage[] | null {
  const existingIdx = currentMessages.findIndex(
    (candidate) => candidate.id === message.id
  );

  if (existingIdx !== -1) {
    return [
      ...currentMessages.slice(0, existingIdx),
      message,
      ...currentMessages.slice(existingIdx + 1),
    ];
  }

  const currentLeafId = currentMessages.at(-1)?.id ?? null;
  if (message.metadata.parentMessageId !== currentLeafId) {
    return null;
  }

  return [...currentMessages, message];
}

// Completes the first received data part into a concrete message (e.g. data-appendMessage).
export function useCompleteDataPart() {
  const { dataStream } = useDataStream();
  const { setMessages } = useChatActions<ChatMessage>();
  const storeApi = useCustomChatStoreApi<ChatMessage>();
  const processedPartsRef = useRef(new Set<string>());

  useEffect(() => {
    if (!dataStream || dataStream.length === 0) {
      return;
    }

    for (const dataPart of dataStream) {
      if (dataPart.type !== "data-appendMessage") {
        continue;
      }

      const partKey = `${dataPart.type}:${dataPart.data}`;
      if (processedPartsRef.current.has(partKey)) {
        continue;
      }
      processedPartsRef.current.add(partKey);

      const message = JSON.parse(dataPart.data) as ChatMessage;
      storeApi.getState().addMessageToTree(message);

      const currentMessages = storeApi.getState().messages as ChatMessage[];
      const nextMessages = mergeCompletedMessageIntoVisiblePath(
        currentMessages,
        message
      );

      if (nextMessages) {
        setMessages(nextMessages);
      }
    }
  }, [dataStream, setMessages, storeApi]);
}
