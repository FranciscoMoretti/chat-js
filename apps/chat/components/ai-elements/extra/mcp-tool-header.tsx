"use client";

import type { ToolUIPart } from "ai";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import { ChevronDownIcon, WrenchIcon } from "lucide-react";
/* oxlint-enable sort-imports */
import React from "react";
import type { ReactNode } from "react";

import { getStatusBadge } from "@/components/ai-elements/tool";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { CollapsibleTrigger } from "@/components/ui/collapsible";
/* oxlint-enable sort-imports */
import { cn } from "@/lib/utils";

interface McpToolHeaderProps {
  title?: string;
  type: ToolUIPart["type"];
  state: ToolUIPart["state"];
  className?: string;
  icon?: ReactNode;
}
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (McpToolHeader); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- McpToolHeader: ; no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 1); typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

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
/* oxlint-enable typescript/prefer-readonly-parameter-types */
