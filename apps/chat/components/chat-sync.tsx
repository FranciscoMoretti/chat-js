"use client";

import { DefaultChatTransport } from "ai";
import { useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import { useSaveMessageMutation } from "@/hooks/chat-sync-hooks";
import { completeDataPart } from "@/lib/ai/complete-data-part";
import { createCompletionQueue } from "@/lib/ai/completion-queue";
import { getStreamErrorToastContent } from "@/lib/ai/stream-errors";
import type { ChatMessage } from "@/lib/ai/types";
import type { ApplicationThread } from "@/lib/application-thread";
import { createGatedChatTransport } from "@/lib/gated-chat-transport";
import { acknowledgeParallelUserMessagePersistence } from "@/lib/parallel-chat-requests";
import { acknowledgeProvisionalUserMessagePersistence } from "@/lib/provisional-chat-confirmations";
import { useChat } from "@/lib/stores/base";
import { useChatPersistenceActions } from "@/lib/stores/hooks-chat-persistence";
import { useDataStream } from "@/lib/stores/hooks-data-stream";
import { fetchWithErrorHandlers } from "@/lib/utils";
import { useSession } from "@/providers/session-provider";

function isResumableActiveStreamId(activeStreamId: string | null | undefined) {
  return !!(activeStreamId && !activeStreamId.startsWith("pending:"));
}

export function ChatSync({
  id,
  thread,
}: {
  id: string;
  thread: ApplicationThread;
}) {
  const { data: session } = useSession();
  const { mutate: saveChatMessage } = useSaveMessageMutation();
  const { setChatPersisted } = useChatPersistenceActions();
  const { setDataStream } = useDataStream();

  const isAuthenticated = !!session?.user;
  const completionQueueRef = useRef(
    createCompletionQueue((error) => {
      console.error("Failed to reconcile completed message", error);
      toast.error(
        "Failed to synchronize a completed response. Refresh to retry."
      );
    })
  );
  const lastMessage = thread.getSnapshot().messages.at(-1);
  const isLastMessagePartial = isResumableActiveStreamId(
    lastMessage?.metadata?.activeStreamId
  );
  const partialMessageId = isLastMessagePartial
    ? (lastMessage?.id ?? null)
    : null;
  const resumeAttemptRef = useRef<string | null>(null);
  const transport = useMemo(
    () =>
      createGatedChatTransport(
        new DefaultChatTransport({
          api: "/api/chat",
          fetch: fetchWithErrorHandlers as typeof fetch,
          prepareSendMessagesRequest({ messages, id: requestId, body }) {
            return {
              body: {
                id: requestId,
                message: messages.at(-1),
                prevMessages: isAuthenticated ? [] : messages.slice(0, -1),
                ...body,
              },
            };
          },
          prepareReconnectToStreamRequest({ id: chatId }) {
            const current = thread.getSnapshot().messages.at(-1);
            const activeStreamId = current?.metadata?.activeStreamId ?? null;
            const partialMessageId = isResumableActiveStreamId(activeStreamId)
              ? (current?.id ?? null)
              : null;

            return {
              api: `/api/chat/${chatId}/stream${partialMessageId ? `?messageId=${encodeURIComponent(partialMessageId)}` : ""}`,
            };
          },
        })
      ),
    [isAuthenticated, thread]
  );

  const { resumeStream } = useChat<ChatMessage>({
    experimental_throttle: 100,
    thread,
    onFinish: ({ message }) => {
      return completionQueueRef.current.waitForIdle().then(() => {
        saveChatMessage({ message, chatId: id });
      });
    },
    transport,
    onData: (dataPart) => {
      completionQueueRef.current.enqueue(() =>
        completeDataPart({ dataPart, thread })
      );
      if (
        dataPart.type === "data-userMessagePersisted" &&
        dataPart.data.chatId === id
      ) {
        acknowledgeParallelUserMessagePersistence(dataPart.data);
        acknowledgeProvisionalUserMessagePersistence(dataPart.data);
        setChatPersisted(true);
      }
      setDataStream((ds) =>
        ds ? [...ds, dataPart as (typeof ds)[number]] : []
      );
    },
    onError: (error) => {
      const { message, description } = getStreamErrorToastContent(error);
      toast.error(message, description ? { description } : undefined);
    },
  });

  useEffect(() => {
    if (!partialMessageId) {
      resumeAttemptRef.current = null;
      return;
    }
    if (resumeAttemptRef.current === partialMessageId) {
      return;
    }

    resumeAttemptRef.current = partialMessageId;
    const run = thread.getRunForMessage(partialMessageId);
    if (run?.status === "submitted" || run?.status === "streaming") {
      return;
    }

    resumeStream({
      body: { assistantMessageId: partialMessageId },
    });
  }, [partialMessageId, resumeStream, thread]);

  return null;
}
