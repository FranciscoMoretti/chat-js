"use client";
/* oxlint-disable sort-imports -- Oxfmt owns this module's external, type-only, and alias import groups; its case-insensitive order conflicts with this declaration-order rule. */

import { RefreshCcw } from "lucide-react";
import React from "react";

import { Action } from "@/components/ai-elements/actions";
import { cn } from "@/lib/utils";
/* oxlint-enable sort-imports */
/* oxlint-disable import/no-named-export, import/prefer-default-export, react/forbid-component-props, typescript/prefer-readonly-parameter-types -- RetryButtonView: import/no-named-export: existing callers import this public component, type, or hook by name; import/prefer-default-export: the existing named import remains stable when this module adds another public declaration; react/forbid-component-props: className and style are the existing Tailwind and primitive composition API; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

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
/* oxlint-enable import/no-named-export, import/prefer-default-export, react/forbid-component-props, typescript/prefer-readonly-parameter-types */
