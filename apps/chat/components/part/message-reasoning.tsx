"use client";

import React, { memo, useEffect, useRef, useState } from "react";
import { BrainIcon } from "lucide-react";
import { Response } from "@/components/ai-elements/response";
import {
  Trace,
  TraceLine,
  TraceIcon,
  TraceTitle,
  TraceCollapsible,
  TraceCollapsibleTrigger,
  TraceCollapsibleContent,
} from "@/components/ui/trace";

const PureReasoningPart = ({
  content,
  isLoading,
}: {
  readonly content: string;
  readonly isLoading: boolean;
}): React.JSX.Element => {
  const [open, setOpen] = useState(true);
  const [duration, setDuration] = useState(0);
  const started = useRef<number | null>(null);
  const closed = useRef(false);
  useEffect((): (() => void) | undefined => {
    if (isLoading) {
      // oxlint-disable-next-line eslint/logical-assignment-operators -- React Compiler does not support logical assignment yet.
      started.current = started.current ?? Date.now();
      return undefined;
    }
    if (started.current !== null) {
      setDuration(Math.round((Date.now() - started.current) / 1000));
      started.current = null;
    }
    if (closed.current) {
      return undefined;
    }
    const timer = setTimeout(() => {
      closed.current = true;
      setOpen(false);
    }, 1000);
    return () => {
      clearTimeout(timer);
    };
  }, [isLoading]);
  return (
    <Trace>
      <TraceCollapsible open={open} onOpenChange={setOpen}>
        <TraceCollapsibleTrigger data-testid="message-reasoning-toggle">
          <TraceLine status={isLoading ? "running" : undefined}>
            <TraceIcon>
              <BrainIcon />
            </TraceIcon>
            <TraceTitle>
              {isLoading
                ? "Thinking..."
                : `Thought for ${duration > 0 ? `${duration} seconds` : "a few seconds"}`}
            </TraceTitle>
          </TraceLine>
        </TraceCollapsibleTrigger>
        <TraceCollapsibleContent data-testid="message-reasoning">
          <Response>{content}</Response>
        </TraceCollapsibleContent>
      </TraceCollapsible>
    </Trace>
  );
};

export const ReasoningPart = memo(PureReasoningPart);
