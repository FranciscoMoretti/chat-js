"use client";
import React from "react";
import { BubbleContent } from "@/components/ui/bubble";
import type { EditableBubbleProps } from "./editable-bubble-props";

export const EditableBubble = ({
  button,
  children,
}: EditableBubbleProps): React.JSX.Element => (
  <BubbleContent
    data-testid="message-content"
    render={button ? <button type="button" {...button} /> : undefined}
  >
    {children}
  </BubbleContent>
);
