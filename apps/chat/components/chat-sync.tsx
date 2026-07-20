"use client";

import { DefaultChatTransport } from "ai";
import { useMemo, useRef } from "react";
import { toast } from "sonner";
import { useSaveMessageMutation } from "@/hooks/chat-sync-hooks";
import { useCompleteDataPart } from "@/hooks/use-complete-data-part";
import { getStreamErrorToastContent } from "@/lib/ai/stream-errors";
import type { ChatMessage } from "@/lib/ai/types";
import { createGatedChatTransport } from "@/lib/gated-chat-transport";
import { acknowledgeParallelUserMessagePersistence } from "@/lib/parallel-chat-requests";
import { acknowledgeProvisionalUserMessagePersistence } from "@/lib/provisional-chat-confirmations";
import { useChat } from "@/lib/stores/base";
import { useChatPersistenceActions } from "@/lib/stores/hooks-chat-persistence";
import { useDataStream } from "@/lib/stores/hooks-data-stream";
import {
  useAddMessageToTree,
  useThreadInitialMessages,
} from "@/lib/stores/hooks-threads";
import { fetchWithErrorHandlers, generateUUID } from "@/lib/utils";
import { useSession } from "@/providers/session-provider";

function isResumableActiveStreamId(activeStreamId: string | null | undefined) {
  return !!(activeStreamId && !activeStreamId.startsWith("pending:"));
}

export function ChatSync({ id }: { id: string }) {
  const { data: session } = useSession();
  const { mutate: saveChatMessage } = useSaveMessageMutation();
  const { setChatPersisted } = useChatPersistenceActions();
  const { setDataStream } = useDataStream();

  const isAuthenticated = !!session?.user;
  const threadInitialMessages = useThreadInitialMessages();
  const addMessageToTree = useAddMessageToTree();
  const lastMessage = threadInitialMessages.at(-1);
  const lastMessageRef = useRef(lastMessage);
  lastMessageRef.current = lastMessage;
  const isLastMessagePartial = isResumableActiveStreamId(
    lastMessage?.metadata?.activeStreamId
  );
  const resumeOnMountRef = useRef(isLastMessagePartial);
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
            const current = lastMessageRef.current;
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
    [isAuthenticated]
  );

  useChat<ChatMessage>({
    experimental_throttle: 100,
    id,
    // TODO: this is a special "snapshot" value in the store that is only updated
    // on store init + sibling switch. Once the store can guarantee up-to-date
    // messages at ChatSync remount time, we can likely remove this override.
    messages: threadInitialMessages,
    generateId: generateUUID,
    onFinish: ({ message }) => {
      addMessageToTree(message);
      saveChatMessage({ message, chatId: id });
    },
    resume: resumeOnMountRef.current,
    transport,
    onData: (dataPart) => {
      if (
        dataPart.type === "data-userMessagePersisted" &&
        dataPart.data.chatId === id
      ) {
        acknowledgeParallelUserMessagePersistence(dataPart.data);
        const matchesPendingChat = acknowledgeProvisionalUserMessagePersistence(
          dataPart.data
        );
        if (matchesPendingChat) {
          setChatPersisted(true);
        }
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

  useCompleteDataPart();

  return null;
}
