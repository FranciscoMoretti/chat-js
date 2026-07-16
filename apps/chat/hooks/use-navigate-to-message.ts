import { useCallback } from "react";
import { useArtifact } from "@/hooks/use-artifact";
import type { ChatMessage } from "@/lib/ai/types";
import { useChatActions } from "@/lib/stores/base";
import { useDataStream } from "@/lib/stores/hooks-data-stream";
import { useSwitchToMessage } from "@/lib/stores/hooks-threads";

export function useNavigateToMessage() {
  const { setMessages } = useChatActions<ChatMessage>();
  const { setDataStream } = useDataStream();
  const { artifact, closeArtifact } = useArtifact();
  const switchToMessage = useSwitchToMessage();

  return useCallback(
    (messageId: string) => {
      setDataStream([]);

      const newThread = switchToMessage(messageId);
      if (newThread) {
        setMessages(newThread);
      }

      if (
        newThread &&
        artifact.isVisible &&
        artifact.messageId &&
        !newThread.some(
          (message: ChatMessage) => message.id === artifact.messageId
        )
      ) {
        closeArtifact();
      }
    },
    [
      artifact.isVisible,
      artifact.messageId,
      closeArtifact,
      setDataStream,
      setMessages,
      switchToMessage,
    ]
  );
}
