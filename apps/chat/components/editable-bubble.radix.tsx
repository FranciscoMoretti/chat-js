"use client";
import React from "react";
import { BubbleContent } from "@/components/ui/bubble";
import type { EditableBubbleProps } from "./editable-bubble-props";

export const EditableBubble = ({
  button,
  children,
}: EditableBubbleProps): React.JSX.Element =>
  button ? (
    <BubbleContent data-testid="message-content" asChild>
      <button type="button" {...button}>
        {children}
      </button>
    </BubbleContent>
  ) : (
    <BubbleContent data-testid="message-content">{children}</BubbleContent>
  );
