"use client";
import React, { memo } from "react";

import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ai-elements/reasoning";

interface MessageReasoningProps {
  content: string;
  isLoading: boolean;
}
/* oxlint-disable typescript/prefer-readonly-parameter-types -- PureReasoningPart: typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { isLoading, content }: MessageReasoningProps). */

const PureReasoningPart = ({
  isLoading,
  content,
}: MessageReasoningProps): React.JSX.Element => (
  <Reasoning className="mb-2" isStreaming={isLoading}>
    <ReasoningTrigger data-testid="message-reasoning-toggle" />
    <ReasoningContent data-testid="message-reasoning">
      {content}
    </ReasoningContent>
  </Reasoning>
);
/* oxlint-enable typescript/prefer-readonly-parameter-types */

export const ReasoningPart = memo(PureReasoningPart);
