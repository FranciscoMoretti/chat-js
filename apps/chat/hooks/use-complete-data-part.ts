"use client";

import { safeValidateUIMessages } from "ai";
import { useEffect, useRef } from "react";
import { type ChatMessage, messageMetadataSchema } from "@/lib/ai/types";
import { useApplicationThread } from "@/lib/stores/custom-store-provider";
import { useDataStream } from "@/lib/stores/hooks-data-stream";

function reviveCreatedAt(key: string, value: unknown): unknown {
  return key === "createdAt" && typeof value === "string"
    ? new Date(value)
    : value;
}

export async function parseAppendedMessage(
  data: string
): Promise<ChatMessage | null> {
  let value: unknown;
  try {
    value = JSON.parse(data, reviveCreatedAt);
  } catch {
    return null;
  }

  const result = await safeValidateUIMessages<ChatMessage>({
    messages: [value],
    metadataSchema: messageMetadataSchema,
  });
  return result.success ? (result.data[0] ?? null) : null;
}

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

// Completes received data parts into concrete messages (e.g. data-appendMessage).
export function useCompleteDataPart() {
  const { dataStream } = useDataStream();
  const thread = useApplicationThread();
  const processedMessageIdsRef = useRef(new Set<string>());

  useEffect(() => {
    if (!dataStream || dataStream.length === 0) {
      return;
    }

    let cancelled = false;
    const completeMessages = async () => {
      for (const dataPart of dataStream) {
        if (dataPart.type !== "data-appendMessage") {
          continue;
        }

        const message = await parseAppendedMessage(dataPart.data);
        if (
          cancelled ||
          !message ||
          processedMessageIdsRef.current.has(message.id)
        ) {
          continue;
        }
        processedMessageIdsRef.current.add(message.id);

        const currentMessages = thread.getSnapshot().messages;
        const nextMessages = mergeCompletedMessageIntoVisiblePath(
          currentMessages,
          message
        );

        if (nextMessages) {
          thread.setMessages(nextMessages);
        } else {
          thread.upsertMessage(message, message.metadata.parentMessageId);
        }
      }
    };

    completeMessages();
    return () => {
      cancelled = true;
    };
  }, [dataStream, thread]);
}
