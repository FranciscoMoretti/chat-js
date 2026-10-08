"use client";

import { GripVertical } from "lucide-react";
import React from "react";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  Panel as ResizablePrimitivePanel,
  PanelGroup as ResizablePrimitivePanelGroup,
  PanelResizeHandle as ResizablePrimitivePanelResizeHandle,
} from "react-resizable-panels";
/* oxlint-enable sort-imports */

import { cn } from "@/lib/utils";

const ResizablePanelGroup = (
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- Forwards the original native element or primitive props, including ref/event callbacks and component constructors; their exact callable and DOM contracts remain flagged by the faithful readonly rule control. */
  {
    className,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    ...props
  }: React.ComponentProps<typeof ResizablePrimitivePanelGroup>
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
): React.JSX.Element => (
  <ResizablePrimitivePanelGroup
    // oxlint-disable-next-line react/forbid-component-props -- ResizablePrimitivePanelGroup accepts className in its styling contract; preserve this caller's layout and appearance.
    className={cn(
      "flex h-full w-full data-[panel-group-direction=vertical]:flex-col",
      className
    )}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward ResizablePanelGroup's ResizablePrimitivePanelGroup prop contract, preserving caller options, children and callbacks.
    {...props}
  />
);

const ResizablePanel = ResizablePrimitivePanel;
/* oxlint-disable react/no-multi-comp, typescript/strict-boolean-expressions -- ResizableHandle: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/strict-boolean-expressions: the existing empty, missing, or optional value deliberately selects this feature fallback (including withHandle). */

const ResizableHandle = (
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- Forwards the original native element or primitive props, including ref/event callbacks and component constructors; their exact callable and DOM contracts remain flagged by the faithful readonly rule control. */
  {
    withHandle,
    className,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes withHandle, className from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    ...props
  }: React.ComponentProps<typeof ResizablePrimitivePanelResizeHandle> & {
    readonly withHandle?: boolean;
  }
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
): React.JSX.Element => (
  <ResizablePrimitivePanelResizeHandle
    // oxlint-disable-next-line react/forbid-component-props -- ResizablePrimitivePanelResizeHandle accepts className in its styling contract; preserve this caller's layout and appearance.
    className={cn(
      "bg-border focus-visible:ring-ring relative flex w-px items-center justify-center after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 focus-visible:ring-1 focus-visible:ring-offset-1 focus-visible:outline-none data-[panel-group-direction=vertical]:h-px data-[panel-group-direction=vertical]:w-full data-[panel-group-direction=vertical]:after:left-0 data-[panel-group-direction=vertical]:after:h-1 data-[panel-group-direction=vertical]:after:w-full data-[panel-group-direction=vertical]:after:translate-x-0 data-[panel-group-direction=vertical]:after:-translate-y-1/2 [&[data-panel-group-direction=vertical]>div]:rotate-90",
      className
    )}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward ResizableHandle's ResizablePrimitivePanelResizeHandle prop contract, preserving caller options, children and callbacks.
    {...props}
  >
    {withHandle && (
      <div className="bg-border z-10 flex h-4 w-3 items-center justify-center rounded-sm border">
        <GripVertical
          // oxlint-disable-next-line react/forbid-component-props -- GripVertical accepts className in its styling contract; preserve this caller's layout and appearance.
          className="h-2.5 w-2.5"
        />
      </div>
    )}
  </ResizablePrimitivePanelResizeHandle>
);
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (ResizableHandle, ResizablePanel, ResizablePanelGroup); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable react/no-multi-comp, typescript/strict-boolean-expressions */

export { ResizableHandle, ResizablePanel, ResizablePanelGroup };
/* oxlint-enable import/no-named-export */
