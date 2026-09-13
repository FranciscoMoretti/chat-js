"use client";

import type { ChatMessage } from "@/lib/ai/types";
import { useMessageResearchUpdatePartByToolCallId } from "@/lib/stores/hooks-message-parts";

import { ResearchUpdates } from "./message-annotations";

type DeepResearchPart = Extract<
  ChatMessage["parts"][number],
  { type: "tool-deepResearch" }
>;

const getOutputError = (part: DeepResearchPart): string | null => {
  if (part.state !== "output-available") {
    return null;
  }
  if (part.output.format !== "problem") {
    return null;
  }
  return part.output.answer;
};

export const DeepResearch = ({
  messageId,
  part,
}: {
  messageId: string;
  part: DeepResearchPart;
}) => {
  const { toolCallId } = part;
  const researchUpdates = useMessageResearchUpdatePartByToolCallId(
    messageId,
    toolCallId
  );

  const outputError = getOutputError(part);

  return (
    <div className="flex w-full flex-col gap-3">
      <ResearchUpdates updates={researchUpdates.map((u) => u.data)} />
      {outputError && (
        <div className="bg-destructive/10 text-destructive-foreground rounded border p-2">
          Error: {outputError}
        </div>
      )}
    </div>
  );
};
