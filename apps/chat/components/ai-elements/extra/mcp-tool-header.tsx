"use client";

import type { ToolUIPart } from "ai";
import { ChevronDownIcon, WrenchIcon } from "lucide-react";
import type { ReactNode } from "react";

import { CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

import { getStatusBadge } from "../tool";

type McpToolHeaderProps = {
  title?: string;
  type: ToolUIPart["type"];
  state: ToolUIPart["state"];
  className?: string;
  icon?: ReactNode;
};

export const McpToolHeader = ({
  className,
  title,
  type,
  state,
  icon,
  ...props
}: McpToolHeaderProps) => (
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
