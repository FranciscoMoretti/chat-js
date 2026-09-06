"use client";
import type { DataUIPart } from "ai";
import { type Dispatch, type SetStateAction, useEffect, useRef } from "react";
import type { ArtifactMetadata } from "@/components/create-artifact";
import { useArtifact } from "@/hooks/use-artifact";
import type {
  ChatMessage,
  CustomUIDataTypes,
  UiToolName,
} from "@/lib/ai/types";
import {
  codeArtifact,
  getCodeArtifactMetadata,
} from "@/lib/artifacts/code/client";
import {
  getSheetArtifactMetadata,
  sheetArtifact,
} from "@/lib/artifacts/sheet/client";
import { textArtifact } from "@/lib/artifacts/text/client";
import { isDataPartOnMessagePath } from "@/lib/data-stream";
import { useChatStoreApi } from "@/lib/stores/base";
import { useDataStream } from "@/lib/stores/hooks-data-stream";
import { useChatInput } from "@/providers/chat-input-provider";

function createTypedMetadataSetter<M extends ArtifactMetadata>(
  setMetadata: Dispatch<SetStateAction<ArtifactMetadata>>,
  coerce: (metadata: ArtifactMetadata) => M
): Dispatch<SetStateAction<M>> {
  return (value) => {
    setMetadata((current) => {
      const typedCurrent = coerce(current);
      return typeof value === "function" ? value(typedCurrent) : value;
    });
  };
}

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

/**
 * Process artifact stream parts (e.g., data-suggestion for text artifacts).
 * Dispatches to artifact-specific onStreamPart handlers.
 */
function processArtifactStreamPart({
  delta,
  artifact,
  setArtifact,
  setMetadata,
}: {
  delta: DataUIPart<CustomUIDataTypes>;
  artifact: ReturnType<typeof useArtifact>["artifact"];
  setArtifact: ReturnType<typeof useArtifact>["setArtifact"];
  setMetadata: ReturnType<typeof useArtifact>["setMetadata"];
}): void {
  switch (artifact.kind) {
    case "code":
      codeArtifact.onStreamPart?.({
        streamPart: delta,
        setArtifact,
        setMetadata: createTypedMetadataSetter(
          setMetadata,
          getCodeArtifactMetadata
        ),
      });
      break;
    case "sheet":
      sheetArtifact.onStreamPart?.({
        streamPart: delta,
        setArtifact,
        setMetadata: createTypedMetadataSetter(
          setMetadata,
          getSheetArtifactMetadata
        ),
      });
      break;
    case "text":
      textArtifact.onStreamPart?.({
        streamPart: delta,
        setArtifact,
        setMetadata,
      });
      break;
    default:
      break;
  }
}

export function DataStreamHandler() {
  const { dataStream } = useDataStream();
  const chatStore = useChatStoreApi<ChatMessage>();
  const { artifact, setArtifact, setMetadata } = useArtifact();
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
    const messages = chatStore.getState().messages;

    for (const delta of newDeltas) {
      if (!isDataPartOnMessagePath(delta, messages)) {
        continue;
      }

      handleResearchUpdate({ delta, setSelectedTool });

      processArtifactStreamPart({
        delta,
        artifact,
        setArtifact,
        setMetadata,
      });
    }
  }, [
    artifact,
    chatStore,
    dataStream,
    setArtifact,
    setMetadata,
    setSelectedTool,
  ]);

  return null;
}
