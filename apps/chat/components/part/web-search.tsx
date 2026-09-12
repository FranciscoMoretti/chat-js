"use client";

import { useMessageResearchUpdatePartByToolCallId } from "@/lib/stores/hooks-message-parts";

import { ResearchUpdates } from "./message-annotations";

export const WebSearch = ({
  messageId,
  part,
}: {
  messageId: string;
  part: { toolCallId: string; state: string };
}) => {
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
};
