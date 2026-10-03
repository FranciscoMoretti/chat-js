"use client";

import type { ToolUIPart } from "ai";
import { ChevronDownIcon, WrenchIcon } from "lucide-react";
import React from "react";
import type { ReactNode } from "react";

import { CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
/* oxlint-disable import/no-relative-parent-imports -- ../tool import: import/no-relative-parent-imports: the fixture imports its adjacent feature directly without creating a test-only alias. */

import { getStatusBadge } from "../tool";
/* oxlint-enable import/no-relative-parent-imports */

interface McpToolHeaderProps {
  title?: string;
  type: ToolUIPart["type"];
  state: ToolUIPart["state"];
  className?: string;
  icon?: ReactNode;
}
/* oxlint-disable no-magic-numbers, typescript/prefer-readonly-parameter-types -- McpToolHeader: ; no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 1); typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

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
    {...props}
  >
    <div className="flex items-center gap-2">
      {icon ?? <WrenchIcon className="text-muted-foreground size-4" />}
      <span className="text-sm font-medium">
        {title ?? type.split("-").slice(1).join("-")}
      </span>
      {getStatusBadge(state)}
    </div>
    <ChevronDownIcon className="text-muted-foreground size-4 transition-transform group-data-[state=open]:rotate-180" />
  </CollapsibleTrigger>
);
/* oxlint-enable no-magic-numbers, typescript/prefer-readonly-parameter-types */
