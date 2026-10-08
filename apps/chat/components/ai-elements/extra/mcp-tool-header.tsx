"use client";

import { ChevronDownIcon, WrenchIcon } from "lucide-react";
import React from "react";
import type { ToolUIPart } from "ai";
import { getStatusBadge } from "@/components/ai-elements/tool";
// oxlint-disable-next-line sort-imports -- Preserve Tool/getStatusBadge-before-Collapsible order: pinned SWC/Node 24 cold loads keep crypto.randomUUID before ReactDOM hooks (dev) and checkDCE (prod); sorting reverses them.
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
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (McpToolHeader); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */

export const McpToolHeader = ({
  className,
  title,
  type,
  state,
  icon,
  // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className, title, type, state, icon from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
  ...props
}: McpToolHeaderProps): React.JSX.Element => (
  <CollapsibleTrigger
    // oxlint-disable-next-line react/forbid-component-props -- CollapsibleTrigger accepts className in its styling contract; preserve this caller's layout and appearance.
    className={cn(
      "flex w-full items-center justify-between gap-4 p-3",
      className
    )}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- McpToolHeader forwards extra caller object properties to CollapsibleTrigger; removing the rest spread would drop existing events and data attributes.
    {...props}
  >
    <div className="flex items-center gap-2">
      {icon ?? (
        <WrenchIcon
          // oxlint-disable-next-line react/forbid-component-props -- WrenchIcon accepts className in its styling contract; preserve this caller's layout and appearance.
          className="text-muted-foreground size-4"
        />
      )}
      <span className="text-sm font-medium">
        {title ?? type.replace(/^[^-]*(?:-|$)/u, "")}
      </span>
      {getStatusBadge(state)}
    </div>
    <ChevronDownIcon
      // oxlint-disable-next-line react/forbid-component-props -- ChevronDownIcon accepts className in its styling contract; preserve this caller's layout and appearance.
      className="text-muted-foreground size-4 transition-transform group-data-[state=open]:rotate-180"
    />
  </CollapsibleTrigger>
);
/* oxlint-enable import/prefer-default-export, import/no-named-export */
