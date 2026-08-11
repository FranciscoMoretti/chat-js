"use client";

import { DefaultChatTransport } from "ai";
import { useRef } from "react";
import { toast } from "sonner";
import { useSaveMessageMutation } from "@/hooks/chat-sync-hooks";
import { useCompleteDataPart } from "@/hooks/use-complete-data-part";
import { getStreamErrorToastContent } from "@/lib/ai/stream-errors";
import type { ChatMessage } from "@/lib/ai/types";
import type { ApplicationThread } from "@/lib/application-thread";
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
  const hasReportedConfirmationRef = useRef(false);
  const lastMessage = thread.getSnapshot().messages.at(-1);
  const lastMessageRef = useRef(lastMessage);
  lastMessageRef.current = lastMessage;
  const isLastMessagePartial = isResumableActiveStreamId(
    lastMessage?.metadata?.activeStreamId
  );

  useChat<ChatMessage>({
    experimental_throttle: 100,
    thread,
    onFinish: ({ message }) => {
      saveChatMessage({ message, chatId: id });
    },
    resume: isLastMessagePartial,
    transport: new DefaultChatTransport({
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
          api: `/api/chat/${chatId}/stream${partialMessageId ? `?messageId=${partialMessageId}` : ""}`,
        };
      },
    }),
    onData: (dataPart) => {
      if (
        !hasReportedConfirmationRef.current &&
        dataPart.type === "data-chatConfirmed" &&
        dataPart.data.chatId === id
      ) {
        hasReportedConfirmationRef.current = true;
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

  useCompleteDataPart();

  return null;
}
