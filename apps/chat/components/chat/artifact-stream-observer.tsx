"use client";
import { useEffect, useSyncExternalStore } from "react";
import { useArtifact } from "@/hooks/use-artifact";
import type { ChatMessage } from "@/lib/ai/types";
import {
  type DocumentToolType,
  documentToolTypes,
} from "@/tools/platform/documents/types";

function isDocumentTool(
  part: ChatMessage["parts"][number]
): part is Extract<ChatMessage["parts"][number], { type: DocumentToolType }> {
  return documentToolTypes.some((type) => type === part.type);
}

export function ArtifactStreamObserver() {
  const { origin } = useArtifact();
  return origin ? (
    <BoundArtifactStreamObserver
      key={`${origin.view.thread.id}:${origin.messageId}`}
      origin={origin}
    />
  ) : null;
}
function BoundArtifactStreamObserver({
  origin,
}: {
  origin: NonNullable<ReturnType<typeof useArtifact>["origin"]>;
}) {
  const snapshot = useSyncExternalStore(
    origin.view.thread.subscribe,
    origin.view.thread.getSnapshot,
    origin.view.thread.getSnapshot
  );
  const { artifact, setArtifact } = useArtifact();
  const message = snapshot.messagesById[origin.messageId];
  const part = message?.parts
    .filter(isDocumentTool)
    .find((tool) =>
      artifact.toolCallId
        ? tool.toolCallId === artifact.toolCallId
        : tool.output?.status === "success" &&
          tool.output.documentId === artifact.documentId
    );
  useEffect(() => {
    if (!part || artifact.status !== "streaming") {
      return;
    }
    const output =
      part.state === "output-available" && part.output?.status === "success"
        ? part.output
        : null;
    const content = part.input?.content ?? "";
    const title = part.input?.title ?? "";
    const status =
      part.state === "output-available" || part.state === "output-error"
        ? "idle"
        : "streaming";
    if (
      content === artifact.content &&
      title === artifact.title &&
      status === artifact.status
    ) {
      return;
    }
    setArtifact((current) =>
      current.messageId === origin.messageId &&
      current.toolCallId === artifact.toolCallId
        ? {
            ...current,
            content,
            title,
            status,
            documentId: output?.documentId ?? current.documentId,
            date: output?.date ?? current.date,
          }
        : current
    );
  }, [part, artifact, origin.messageId, setArtifact]);
  return null;
}
