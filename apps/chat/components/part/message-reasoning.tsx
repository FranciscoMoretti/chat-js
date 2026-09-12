"use client";
import { memo } from "react";

import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ai-elements/reasoning";

interface MessageReasoningProps {
  content: string;
  isLoading: boolean;
}

const PureReasoningPart = ({ isLoading, content }: MessageReasoningProps) => (
  <Reasoning className="mb-2" isStreaming={isLoading}>
    <ReasoningTrigger data-testid="message-reasoning-toggle" />
    <ReasoningContent data-testid="message-reasoning">
      {content}
    </ReasoningContent>
  </Reasoning>
);

export const ReasoningPart = memo(PureReasoningPart);
