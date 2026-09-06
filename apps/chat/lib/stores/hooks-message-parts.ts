// This file has hooks that are enabled by the with-message-parts middleware

import equal from "fast-deep-equal";
import { shallow } from "zustand/shallow";
import { useViewMessages, useViewSelector } from "@/lib/chat/view-hooks";
import { documentToolTypes } from "@/tools/platform/documents/types";
import type { ChatMessage } from "../ai/types";

const artifactToolTypes = [...documentToolTypes, "tool-deepResearch"] as const;

export const useMessagePartTypesById = (
  messageId: string
): ChatMessage["parts"][number]["type"][] =>
  useViewSelector(
    (state) =>
      state.snapshot.messagesById[messageId]?.parts.map((part) => part.type) ??
      [],
    shallow
  );

export function useMessagePartByPartIdx(
  messageId: string,
  partIdx: number
): ChatMessage["parts"][number];
export function useMessagePartByPartIdx<
  T extends ChatMessage["parts"][number]["type"],
>(
  messageId: string,
  partIdx: number,
  type: T
): Extract<ChatMessage["parts"][number], { type: T }>;
export function useMessagePartByPartIdx<
  T extends ChatMessage["parts"][number]["type"],
>(messageId: string, partIdx: number, type?: T) {
  const part = useViewSelector(
    (state) => state.snapshot.messagesById[messageId]?.parts[partIdx]
  );
  if (!part) {
    throw new Error(`Missing part ${messageId}:${partIdx}`);
  }
  if (type !== undefined && part.type !== type) {
    throw new Error(
      `Part type mismatch for id: ${messageId} at partIdx: ${partIdx}. Expected ${String(type)}, got ${String(
        part.type
      )}`
    );
  }
  return part;
}

export function useMessageResearchUpdatePartByToolCallId(
  messageId: string,
  toolCallId: string
): Extract<ChatMessage["parts"][number], { type: "data-researchUpdate" }>[] {
  return useViewSelector(
    (state) =>
      state.snapshot.messagesById[messageId]?.parts
        .filter((part) => part.type === "data-researchUpdate")
        .filter((part) => part.data.toolCallId === toolCallId) ?? [],
    equal
  );
}

export function useIsLastArtifact(toolCallId: string): boolean {
  return useViewMessages((messages) => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      if (message.role !== "assistant") {
        continue;
      }

      for (const part of message.parts) {
        if (
          "toolCallId" in part &&
          (artifactToolTypes as readonly string[]).includes(part.type) &&
          part.state === "output-available"
        ) {
          return part.toolCallId === toolCallId;
        }
      }
    }

    return false;
  });
}
