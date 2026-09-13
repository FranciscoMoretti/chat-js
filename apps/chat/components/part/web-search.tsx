"use client";

import type { ChatMessage } from "@/lib/ai/types";
import { useMessageResearchUpdatePartByToolCallId } from "@/lib/stores/hooks-message-parts";

import { ResearchUpdates } from "./message-annotations";

export function WebSearch({
  messageId,
  part,
}: {
  messageId: string;
  part: Extract<ChatMessage["parts"][number], { type: "tool-webSearch" }>;
}) {
  const { toolCallId, state } = part;
  const researchUpdates = useMessageResearchUpdatePartByToolCallId(
    messageId,
    toolCallId
  );

  if (state === "input-available" || state === "output-available") {
    return (
      <div className="flex flex-col gap-3" key={toolCallId}>
        <ResearchUpdates updates={researchUpdates.map((u) => u.data)} />
      </div>
    );
  }
  return null;
}
