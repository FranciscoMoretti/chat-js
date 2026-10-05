"use client";
import React, { memo } from "react";

import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ai-elements/reasoning";

interface MessageReasoningProps {
  readonly content: string;
  readonly isLoading: boolean;
}

const PureReasoningPart = ({
  isLoading,
  content,
}: MessageReasoningProps): React.JSX.Element => (
  <Reasoning
    // oxlint-disable-next-line react/forbid-component-props -- Reasoning accepts className in its styling contract; preserve this caller's layout and appearance.
    className="mb-2"
    isStreaming={isLoading}
  >
    <ReasoningTrigger data-testid="message-reasoning-toggle" />
    <ReasoningContent data-testid="message-reasoning">
      {content}
    </ReasoningContent>
  </Reasoning>
);

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (ReasoningPart); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export const ReasoningPart = memo(PureReasoningPart);
/* oxlint-enable import/prefer-default-export, import/no-named-export */
