"use client";

import { RefreshCcw } from "lucide-react";
import React from "react";

import { Action } from "@/components/ai-elements/actions";
import { cn } from "@/lib/utils";
/* oxlint-disable react/forbid-component-props, typescript/prefer-readonly-parameter-types -- RetryButtonView: ; react/forbid-component-props: className and style are the existing Tailwind and primitive composition API; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

export const RetryButtonView = ({
  onRetry,
  disabled = false,
  className,
}: {
  onRetry: () => void;
  disabled?: boolean;
  className?: string;
}): React.JSX.Element => (
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
/* oxlint-enable react/forbid-component-props, typescript/prefer-readonly-parameter-types */
