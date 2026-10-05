"use client";

import {
  Corner as ScrollAreaPrimitiveCorner,
  Root as ScrollAreaPrimitiveRoot,
  ScrollAreaScrollbar as ScrollAreaPrimitiveScrollAreaScrollbar,
  ScrollAreaThumb as ScrollAreaPrimitiveScrollAreaThumb,
  Viewport as ScrollAreaPrimitiveViewport,
} from "@radix-ui/react-scroll-area";
import { forwardRef as reactForwardRef } from "react";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type {
  ComponentPropsWithoutRef as ReactComponentPropsWithoutRef,
  ComponentRef as ReactComponentRef,
  JSX as ReactJSX,
} from "react";
/* oxlint-enable sort-imports */

import { cn } from "@/lib/utils";
/* oxlint-disable typescript/prefer-readonly-parameter-types -- ScrollBar: typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, orientation = "vertical", ...props }). */

/* oxlint-disable react/react-in-jsx-scope -- ScrollBar uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const ScrollBar = reactForwardRef<
  ReactComponentRef<typeof ScrollAreaPrimitiveScrollAreaScrollbar>,
  ReactComponentPropsWithoutRef<typeof ScrollAreaPrimitiveScrollAreaScrollbar>
>(
  (
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className, orientation from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    { className, orientation = "vertical", ...props },
    ref
  ): ReactJSX.Element => (
    <ScrollAreaPrimitiveScrollAreaScrollbar
      // oxlint-disable-next-line react/forbid-component-props -- ScrollAreaPrimitiveScrollAreaScrollbar accepts className in its styling contract; preserve this caller's layout and appearance.
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
      <ScrollAreaPrimitiveScrollAreaThumb
        // oxlint-disable-next-line react/forbid-component-props -- ScrollAreaPrimitiveScrollAreaThumb accepts className in its styling contract; preserve this caller's layout and appearance.
        className="bg-border relative flex-1 rounded-full"
      />
    </ScrollAreaPrimitiveScrollAreaScrollbar>
  )
);
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
ScrollBar.displayName = ScrollAreaPrimitiveScrollAreaScrollbar.displayName;
/* oxlint-disable typescript/prefer-readonly-parameter-types -- ScrollArea: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, children, ...props }). */

/* oxlint-disable react/react-in-jsx-scope -- ScrollArea uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const ScrollArea = reactForwardRef<
  ReactComponentRef<typeof ScrollAreaPrimitiveRoot>,
  ReactComponentPropsWithoutRef<typeof ScrollAreaPrimitiveRoot>
  // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className, children from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
>(({ className, children, ...props }, ref): ReactJSX.Element => (
  <ScrollAreaPrimitiveRoot
    // oxlint-disable-next-line react/forbid-component-props -- ScrollAreaPrimitiveRoot accepts className in its styling contract; preserve this caller's layout and appearance.
    className={cn("relative overflow-hidden", className)}
    ref={ref}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward ScrollArea's ScrollAreaPrimitiveRoot prop contract, preserving caller options, children and callbacks.
    {...props}
  >
    <ScrollAreaPrimitiveViewport
      // oxlint-disable-next-line react/forbid-component-props -- ScrollAreaPrimitiveViewport accepts className in its styling contract; preserve this caller's layout and appearance.
      className="h-full w-full rounded-[inherit]"
    >
      {children}
    </ScrollAreaPrimitiveViewport>
    <ScrollBar />
    <ScrollAreaPrimitiveCorner />
  </ScrollAreaPrimitiveRoot>
));
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
ScrollArea.displayName = ScrollAreaPrimitiveRoot.displayName;

/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (ScrollArea, ScrollBar); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export { ScrollArea, ScrollBar };
/* oxlint-enable import/no-named-export */
