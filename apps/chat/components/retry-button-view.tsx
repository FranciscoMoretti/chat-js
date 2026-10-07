"use client";

import { RefreshCcw } from "lucide-react";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import React from "react";
/* oxlint-enable sort-imports */

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { Action } from "@/components/ai-elements/actions";
/* oxlint-enable sort-imports */
import { cn } from "@/lib/utils";

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (RetryButtonView); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export const RetryButtonView = ({
  onRetry,
  disabled = false,
  className,
}: {
  readonly onRetry: () => void;
  readonly disabled?: boolean;
  readonly className?: string;
}): React.JSX.Element => (
  <Action
    // oxlint-disable-next-line react/forbid-component-props -- Action accepts className in its styling contract; preserve this caller's layout and appearance.
    className={cn(
      "text-muted-foreground hover:bg-accent hover:text-accent-foreground h-7 w-7 p-0",
      className
    )}
    disabled={disabled}
    onClick={onRetry}
    tooltip="Retry"
  >
    <RefreshCcw
      // oxlint-disable-next-line react/forbid-component-props -- RefreshCcw accepts className in its styling contract; preserve this caller's layout and appearance.
      className="h-3.5 w-3.5"
    />
  </Action>
);
/* oxlint-enable import/prefer-default-export, import/no-named-export */
