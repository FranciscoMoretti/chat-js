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
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (SidebarToggle); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable react/jsx-no-literals -- SidebarToggle renders authored interface labels, status copy and display punctuation; no translation-layer contract is defined here. */
/* oxlint-disable react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth, react/jsx-props-no-spreading -- SidebarToggle: ; react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships */

export const SidebarToggle = (
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- Forwards the original native element or primitive props, including ref/event callbacks and component constructors; their exact callable and DOM contracts remain flagged by the faithful readonly rule control. */
  {
    className,
    onClick,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className, onClick from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    ...props
  }: ComponentProps<typeof SidebarTrigger>
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
): ReactJSX.Element => {
  const { toggleSidebar } = useSidebar();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          {...props}
          // oxlint-disable-next-line react/forbid-component-props -- Button accepts className in its styling contract; preserve this caller's layout and appearance.
          className={className}
          onClick={(
            /* oxlint-disable typescript/prefer-readonly-parameter-types -- The original native event is forwarded to its caller or native handler; retain event methods and mutable target DOM identity. */
            event
            /* oxlint-enable typescript/prefer-readonly-parameter-types */
          ) => {
            // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when calling onClick; preserve one receiver evaluation, skipped call arguments and the undefined short-circuit result. The app guidance prefers optional chaining.
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
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable react/jsx-no-literals */
/* oxlint-enable react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth, react/jsx-props-no-spreading */
