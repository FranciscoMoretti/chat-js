"use client";

import { RefreshCcw } from "lucide-react";

import { Action } from "@/components/ai-elements/actions";
import { cn } from "@/lib/utils";

export const RetryButtonView = ({
  onRetry,
  disabled = false,
  className,
}: {
  onRetry: () => void;
  disabled?: boolean;
  className?: string;
}) => (
  <Action
    className={cn(
      "text-muted-foreground hover:bg-accent hover:text-accent-foreground h-7 w-7 p-0",
      className
    )}
    disabled={disabled}
    onClick={onRetry}
    tooltip="Retry"
  >
    <RefreshCcw className="h-3.5 w-3.5" />
  </Action>
);
