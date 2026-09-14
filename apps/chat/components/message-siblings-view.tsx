"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { Action } from "@/components/ai-elements/actions";

export const MessageSiblingsView = ({
  index,
  count,
  disabled = false,
  onPrevious,
  onNext,
}: {
  index: number;
  count: number;
  disabled?: boolean;
  onPrevious: () => void;
  onNext: () => void;
}) => (
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
