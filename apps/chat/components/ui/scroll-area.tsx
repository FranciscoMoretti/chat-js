"use client";

import type {
  ComponentPropsWithoutRef as ReactComponentPropsWithoutRef,
  ComponentRef as ReactComponentRef,
  JSX as ReactJSX,
} from "react";
import {
  Corner as ScrollAreaPrimitiveCorner,
  Root as ScrollAreaPrimitiveRoot,
  ScrollAreaScrollbar as ScrollAreaPrimitiveScrollAreaScrollbar,
  ScrollAreaThumb as ScrollAreaPrimitiveScrollAreaThumb,
  Viewport as ScrollAreaPrimitiveViewport,
} from "@radix-ui/react-scroll-area";
import { cn } from "@/lib/utils";
import { forwardRef as reactForwardRef } from "react";

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
      {...props}
    >
      <ScrollAreaPrimitiveScrollAreaThumb className="bg-border relative flex-1 rounded-full" />
    </ScrollAreaPrimitiveScrollAreaScrollbar>
  )
);

ScrollBar.displayName = ScrollAreaPrimitiveScrollAreaScrollbar.displayName;

const ScrollArea = reactForwardRef<
  ReactComponentRef<typeof ScrollAreaPrimitiveRoot>,
  ReactComponentPropsWithoutRef<typeof ScrollAreaPrimitiveRoot>
>(
  (
    { className, children, ...props },

    ref
  ): ReactJSX.Element => (
    <ScrollAreaPrimitiveRoot
      className={cn("relative overflow-hidden", className)}
      ref={ref}
      {...props}
    >
      <ScrollAreaPrimitiveViewport className="h-full w-full rounded-[inherit]">
        {children}
      </ScrollAreaPrimitiveViewport>
      <ScrollBar />
      <ScrollAreaPrimitiveCorner />
    </ScrollAreaPrimitiveRoot>
  )
);

ScrollArea.displayName = ScrollAreaPrimitiveRoot.displayName;

export { ScrollArea, ScrollBar };
