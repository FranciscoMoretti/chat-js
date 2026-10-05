import { PanelLeft } from "lucide-react";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { ComponentProps, JSX as ReactJSX } from "react";
/* oxlint-enable sort-imports */
import React from "react";

import type { SidebarTrigger } from "@/components/ui/sidebar";
import { useSidebar } from "@/components/ui/sidebar";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
/* oxlint-enable sort-imports */

import { Button } from "./ui/button";
/* oxlint-disable react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth, react/jsx-props-no-spreading, typescript/prefer-readonly-parameter-types -- SidebarToggle: ; react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including event). */

export const SidebarToggle = ({
  className,
  onClick,
  ...props
}: ComponentProps<typeof SidebarTrigger>): ReactJSX.Element => {
  const { toggleSidebar } = useSidebar();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          {...props}
          // oxlint-disable-next-line react/forbid-component-props -- Button accepts className in its styling contract; preserve this caller's layout and appearance.
          className={className}
          onClick={(event) => {
            onClick?.(event);
            if (!event.defaultPrevented) {
              toggleSidebar();
            }
          }}
          size="icon"
          variant="ghost"
        >
          <PanelLeft size={16} />
        </Button>
      </TooltipTrigger>
      <TooltipContent align="start">Toggle Sidebar</TooltipContent>
    </Tooltip>
  );
};
/* oxlint-enable react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth, react/jsx-props-no-spreading, typescript/prefer-readonly-parameter-types */
