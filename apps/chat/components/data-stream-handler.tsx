"use client";
import type { DataUIPart } from "ai";
import { type Dispatch, type SetStateAction, useEffect, useRef } from "react";
import { useConversationView } from "@/components/chat/conversation-view";
import type { CustomUIDataTypes, UiToolName } from "@/lib/ai/types";
import { isDataPartOnMessagePath } from "@/lib/data-stream";
import { useDataStream } from "@/lib/stores/hooks-data-stream";
import { useChatInput } from "@/providers/chat-input-provider";

function handleResearchUpdate({
  delta,
  setSelectedTool,
}: {
  delta: DataUIPart<CustomUIDataTypes>;
  setSelectedTool: Dispatch<SetStateAction<UiToolName | null>>;
}): void {
  if (delta.type === "data-researchUpdate") {
    const update = delta.data;
    if (update?.type === "completed") {
      setSelectedTool((current) =>
        current === "deepResearch" ? null : current
      );
    }
  }
}

export function DataStreamHandler() {
  const { dataStream } = useDataStream();
  const view = useConversationView();
  const lastProcessedIndex = useRef(-1);
  const lastProcessedPart = useRef<DataUIPart<CustomUIDataTypes> | undefined>(
    undefined
  );
  const { setSelectedTool } = useChatInput();

  useEffect(() => {
    if (!dataStream?.length) {
      lastProcessedIndex.current = -1;
      lastProcessedPart.current = undefined;
      return;
    }

    if (
      lastProcessedIndex.current >= 0 &&
      dataStream[lastProcessedIndex.current] !== lastProcessedPart.current
    ) {
      lastProcessedIndex.current = -1;
    }

    const newDeltas = dataStream.slice(lastProcessedIndex.current + 1);
    lastProcessedIndex.current = dataStream.length - 1;
    lastProcessedPart.current = dataStream.at(-1);
    const messages = view.getMessages();

    for (const delta of newDeltas) {
      if (!isDataPartOnMessagePath(delta, messages)) {
        continue;
      }

      handleResearchUpdate({ delta, setSelectedTool });
    }
  }, [view, dataStream, setSelectedTool]);

  return null;
}
