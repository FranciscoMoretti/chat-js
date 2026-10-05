"use client";

import {
  ScrollAreaScrollbar as ScrollAreaPrimitiveScrollAreaScrollbar,
  ScrollAreaThumb as ScrollAreaPrimitiveScrollAreaThumb,
  Root as ScrollAreaPrimitiveRoot,
  Viewport as ScrollAreaPrimitiveViewport,
  Corner as ScrollAreaPrimitiveCorner,
} from "@radix-ui/react-scroll-area";
import { forwardRef as reactForwardRef } from "react";
import type {
  ComponentRef as ReactComponentRef,
  ComponentPropsWithoutRef as ReactComponentPropsWithoutRef,
  JSX as ReactJSX,
} from "react";

import { cn } from "@/lib/utils";
/* oxlint-disable typescript/prefer-readonly-parameter-types -- ScrollBar: typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, orientation = "vertical", ...props }). */

const ScrollBar = reactForwardRef<
  ReactComponentRef<typeof ScrollAreaPrimitiveScrollAreaScrollbar>,
  ReactComponentPropsWithoutRef<typeof ScrollAreaPrimitiveScrollAreaScrollbar>
>(
  (
    { className, orientation = "vertical", ...props },
    ref
  ): ReactJSX.Element => (
    <ScrollAreaPrimitiveScrollAreaScrollbar
      className={cn(
        "flex touch-none transition-colors select-none",
        orientation === "vertical" &&
          "h-full w-2.5 border-l border-l-transparent p-[1px]",
        orientation === "horizontal" &&
          "h-2.5 flex-col border-t border-t-transparent p-[1px]",
        className
      )}
      orientation={orientation}
      ref={ref}
      // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward ScrollBar's ScrollAreaPrimitiveScrollAreaScrollbar prop contract, preserving caller options, children and callbacks.
      {...props}
    >
      <ScrollAreaPrimitiveScrollAreaThumb className="bg-border relative flex-1 rounded-full" />
    </ScrollAreaPrimitiveScrollAreaScrollbar>
  )
);
/* oxlint-enable typescript/prefer-readonly-parameter-types */
ScrollBar.displayName = ScrollAreaPrimitiveScrollAreaScrollbar.displayName;
/* oxlint-disable typescript/prefer-readonly-parameter-types -- ScrollArea: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, children, ...props }). */

const ScrollArea = reactForwardRef<
  ReactComponentRef<typeof ScrollAreaPrimitiveRoot>,
  ReactComponentPropsWithoutRef<typeof ScrollAreaPrimitiveRoot>
>(({ className, children, ...props }, ref): ReactJSX.Element => (
  <ScrollAreaPrimitiveRoot
    className={cn("relative overflow-hidden", className)}
    ref={ref}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward ScrollArea's ScrollAreaPrimitiveRoot prop contract, preserving caller options, children and callbacks.
    {...props}
  >
    <ScrollAreaPrimitiveViewport className="h-full w-full rounded-[inherit]">
      {children}
    </ScrollAreaPrimitiveViewport>
    <ScrollBar />
    <ScrollAreaPrimitiveCorner />
  </ScrollAreaPrimitiveRoot>
));
/* oxlint-enable typescript/prefer-readonly-parameter-types */
ScrollArea.displayName = ScrollAreaPrimitiveRoot.displayName;

export { ScrollArea, ScrollBar };
