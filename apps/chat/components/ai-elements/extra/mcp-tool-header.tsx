"use client";

import type { ToolUIPart } from "ai";
import { ChevronDownIcon, WrenchIcon } from "lucide-react";
import React from "react";
import type { ReactNode } from "react";

import { getStatusBadge } from "@/components/ai-elements/tool";
import { CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

interface McpToolHeaderProps {
  title?: string;
  type: ToolUIPart["type"];
  state: ToolUIPart["state"];
  className?: string;
  icon?: ReactNode;
}
/* oxlint-disable typescript/prefer-readonly-parameter-types -- McpToolHeader: ; no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 1); typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

export const McpToolHeader = ({
  className,
  title,
  type,
  state,
  icon,
  ...props
}: McpToolHeaderProps): React.JSX.Element => (
  <CollapsibleTrigger
    className={cn(
      "flex w-full items-center justify-between gap-4 p-3",
      className
    )}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- McpToolHeader forwards extra caller object properties to CollapsibleTrigger; removing the rest spread would drop existing events and data attributes.
    {...props}
  >
    <div className="flex items-center gap-2">
      {icon ?? <WrenchIcon className="text-muted-foreground size-4" />}
      <span className="text-sm font-medium">
        {title ?? type.replace(/^[^-]*(?:-|$)/u, "")}
      </span>
      {getStatusBadge(state)}
    </div>
    <ChevronDownIcon className="text-muted-foreground size-4 transition-transform group-data-[state=open]:rotate-180" />
  </CollapsibleTrigger>
);
/* oxlint-enable typescript/prefer-readonly-parameter-types */
