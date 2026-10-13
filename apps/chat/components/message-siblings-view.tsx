"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Action } from "@/components/ai-elements/actions";

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
        <Action
          className="text-muted-foreground hover:bg-accent hover:text-accent-foreground h-7 w-7 px-0"
          disabled={disabled || index === 0}
          onClick={onPrevious}
          tooltip="Previous version"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </Action>
        <span className="text-muted-foreground text-xs">
          {index + 1}/{count}
        </span>
        <Action
          className="text-muted-foreground hover:bg-accent hover:text-accent-foreground h-7 w-7 px-0"
          disabled={disabled || index === count - 1}
          onClick={onNext}
          tooltip="Next version"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </Action>
      </>
    )}
  </div>
);
