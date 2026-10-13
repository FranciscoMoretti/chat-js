"use client";

import { ChevronDownIcon, WrenchIcon } from "lucide-react";
import React from "react";
import type { ToolUIPart } from "ai";
import { getStatusBadge } from "@/components/ai-elements/tool";
import { CollapsibleTrigger } from "@/components/ui/collapsible";
import type { ReadonlyReactNode } from "@/lib/readonly-react-node";
import { cn } from "@/lib/utils";

interface McpToolHeaderProps {
  readonly title?: string;
  readonly type: ToolUIPart["type"];
  readonly state: ToolUIPart["state"];
  readonly className?: string;
  readonly icon?: ReadonlyReactNode;
}

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
        {title ?? type.replace(/^[^-]*(?:-|$)/u, "")}
      </span>
      {getStatusBadge(state)}
    </div>
    <ChevronDownIcon className="text-muted-foreground size-4 transition-transform group-data-[state=open]:rotate-180" />
  </CollapsibleTrigger>
);
