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
/* oxlint-disable react/forbid-component-props, typescript/prefer-readonly-parameter-types -- PureReasoningPart: react/forbid-component-props: className and style are the existing Tailwind and primitive composition API; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { isLoading, content }: MessageReasoningProps). */

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
/* oxlint-enable react/forbid-component-props, typescript/prefer-readonly-parameter-types */
/* oxlint-disable import/no-named-export, import/prefer-default-export -- ReasoningPart: import/no-named-export: existing callers import this public component, type, or hook by name; import/prefer-default-export: the existing named import remains stable when this module adds another public declaration. */

export const ReasoningPart = memo(PureReasoningPart);
/* oxlint-enable import/no-named-export, import/prefer-default-export */
