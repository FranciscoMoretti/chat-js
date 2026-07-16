import { useCallback } from "react";
import { useArtifact } from "@/hooks/use-artifact";
import type { ChatMessage } from "@/lib/ai/types";
import { useChatActions } from "@/lib/stores/base";
import { useDataStream } from "@/lib/stores/hooks-data-stream";
import { useSwitchToSibling } from "@/lib/stores/hooks-threads";

/**
 * Navigate to a sibling thread while preserving branch-owned active runs.
 * Uses the store's switchToSibling for the pure state transition.
 */
export function useNavigateToSibling() {
  const { setMessages } = useChatActions<ChatMessage>();
  const { setDataStream } = useDataStream();
  const { artifact, closeArtifact } = useArtifact();
  const switchToSibling = useSwitchToSibling();

  return useCallback(
    (messageId: string, direction: "prev" | "next") => {
      // Data parts belong to the previously selected path. Active runs remain
      // owned by ThreadChat and continue updating their tree nodes.
      setDataStream([]);

      const newThread = switchToSibling(messageId, direction);
      if (newThread) {
        setMessages(newThread);
      }

      // Close artifact if its message is not in the new thread
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
      switchToSibling,
    ]
  );
}
