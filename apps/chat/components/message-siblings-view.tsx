"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { MessageAction } from "@/components/message-action";

import React from "react";

export const MessageSiblingsView = ({
  index,
  count,
  disabled = false,
  onPrevious,
  onNext,
}: {
  readonly index: number;
  readonly count: number;
  readonly disabled?: boolean;
  readonly onPrevious: () => void;
  readonly onNext: () => void;
}): React.JSX.Element => (
  <div className="flex items-center justify-center gap-1">
    {count > 1 && (
      <>
        <MessageAction
          className="text-muted-foreground hover:bg-accent hover:text-accent-foreground relative h-7 w-7 px-0 py-1.5"
          disabled={disabled || index === 0}
          onClick={onPrevious}
          size="sm"
          tooltip="Previous version"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </MessageAction>
        <span className="text-muted-foreground text-xs">
          {index + 1}/{count}
        </span>
        <MessageAction
          className="text-muted-foreground hover:bg-accent hover:text-accent-foreground relative h-7 w-7 px-0 py-1.5"
          disabled={disabled || index === count - 1}
          onClick={onNext}
          size="sm"
          tooltip="Next version"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </MessageAction>
      </>
    )}
  </div>
);
