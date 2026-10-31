"use client";

import { MessageAction } from "@/components/message-action";

import React from "react";

import { RefreshCcw } from "lucide-react";

import { cn } from "@/lib/utils";

export const RetryButtonView = ({
  onRetry,
  disabled = false,
  className,
}: {
  readonly onRetry: () => void;
  readonly disabled?: boolean;
  readonly className?: string;
}): React.JSX.Element => (
  <MessageAction
    className={cn(
      "text-muted-foreground hover:bg-accent hover:text-accent-foreground relative h-7 w-7 p-0",
      className
    )}
    disabled={disabled}
    onClick={onRetry}
    size="sm"
    tooltip="Regenerate response"
  >
    <RefreshCcw className="h-3.5 w-3.5" />
  </MessageAction>
);
