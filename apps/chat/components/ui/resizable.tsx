"use client";

import { GripVertical } from "lucide-react";
import React from "react";
/* oxlint-disable import/no-namespace -- react-resizable-panels import: import/no-namespace: the React or primitive namespace carries the library component and type contract. */
import * as ResizablePrimitive from "react-resizable-panels";
/* oxlint-enable import/no-namespace */

import { cn } from "@/lib/utils";
/* oxlint-disable typescript/prefer-readonly-parameter-types -- ResizablePanelGroup: typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

const ResizablePanelGroup = ({
  className,
  ...props
}: React.ComponentProps<
  typeof ResizablePrimitive.PanelGroup
>): React.JSX.Element => (
  <ResizablePrimitive.PanelGroup
    className={cn(
      "flex h-full w-full data-[panel-group-direction=vertical]:flex-col",
      className
    )}
    {...props}
  />
);
/* oxlint-enable typescript/prefer-readonly-parameter-types */

const ResizablePanel = ResizablePrimitive.Panel;
/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions -- ResizableHandle: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types; typescript/strict-boolean-expressions: the existing empty, missing, or optional value deliberately selects this feature fallback (including withHandle). */

const ResizableHandle = ({
  withHandle,
  className,
  ...props
}: React.ComponentProps<typeof ResizablePrimitive.PanelResizeHandle> & {
  withHandle?: boolean;
}): React.JSX.Element => (
  <ResizablePrimitive.PanelResizeHandle
    className={cn(
      "bg-border focus-visible:ring-ring relative flex w-px items-center justify-center after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 focus-visible:ring-1 focus-visible:ring-offset-1 focus-visible:outline-none data-[panel-group-direction=vertical]:h-px data-[panel-group-direction=vertical]:w-full data-[panel-group-direction=vertical]:after:left-0 data-[panel-group-direction=vertical]:after:h-1 data-[panel-group-direction=vertical]:after:w-full data-[panel-group-direction=vertical]:after:translate-x-0 data-[panel-group-direction=vertical]:after:-translate-y-1/2 [&[data-panel-group-direction=vertical]>div]:rotate-90",
      className
    )}
    {...props}
  >
    {withHandle && (
      <div className="bg-border z-10 flex h-4 w-3 items-center justify-center rounded-sm border">
        <GripVertical className="h-2.5 w-2.5" />
      </div>
    )}
  </ResizablePrimitive.PanelResizeHandle>
);
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */

export { ResizableHandle, ResizablePanel, ResizablePanelGroup };
