"use client";
/* oxlint-disable sort-imports -- Oxfmt owns this module's external, type-only, and alias import groups; its case-insensitive order conflicts with this declaration-order rule. */

/* oxlint-disable import/no-namespace -- @radix-ui/react-scroll-area import: import/no-namespace: the React or primitive namespace carries the library component and type contract. */

import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";
/* oxlint-enable import/no-namespace */
/* oxlint-disable import/no-namespace -- react import: import/no-namespace: the React or primitive namespace carries the library component and type contract. */
import * as React from "react";
/* oxlint-enable import/no-namespace */

import { cn } from "@/lib/utils";
/* oxlint-enable sort-imports */
/* oxlint-disable oxc/no-rest-spread-properties, react/forbid-component-props, react/jsx-props-no-spreading, typescript/prefer-readonly-parameter-types -- ScrollBar: oxc/no-rest-spread-properties: compose immutable state or forward the remaining typed props without mutating the caller object; react/forbid-component-props: className and style are the existing Tailwind and primitive composition API; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, orientation = "vertical", ...props }). */

const ScrollBar = React.forwardRef<
  React.ComponentRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>
>(
  (
    { className, orientation = "vertical", ...props },
    ref
  ): React.JSX.Element => (
    <ScrollAreaPrimitive.ScrollAreaScrollbar
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
      <ScrollAreaPrimitive.ScrollAreaThumb className="bg-border relative flex-1 rounded-full" />
    </ScrollAreaPrimitive.ScrollAreaScrollbar>
  )
);
/* oxlint-enable oxc/no-rest-spread-properties, react/forbid-component-props, react/jsx-props-no-spreading, typescript/prefer-readonly-parameter-types */
ScrollBar.displayName = ScrollAreaPrimitive.ScrollAreaScrollbar.displayName;
/* oxlint-disable oxc/no-rest-spread-properties, react/forbid-component-props, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- ScrollArea: oxc/no-rest-spread-properties: compose immutable state or forward the remaining typed props without mutating the caller object; react/forbid-component-props: className and style are the existing Tailwind and primitive composition API; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, children, ...props }). */

const ScrollArea = React.forwardRef<
  React.ComponentRef<typeof ScrollAreaPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Root>
>(({ className, children, ...props }, ref): React.JSX.Element => (
  <ScrollAreaPrimitive.Root
    className={cn("relative overflow-hidden", className)}
    ref={ref}
    {...props}
  >
    <ScrollAreaPrimitive.Viewport className="h-full w-full rounded-[inherit]">
      {children}
    </ScrollAreaPrimitive.Viewport>
    <ScrollBar />
    <ScrollAreaPrimitive.Corner />
  </ScrollAreaPrimitive.Root>
));
/* oxlint-enable oxc/no-rest-spread-properties, react/forbid-component-props, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types */
ScrollArea.displayName = ScrollAreaPrimitive.Root.displayName;
/* oxlint-disable import/no-named-export -- scroll-area.tsx exports: import/no-named-export: existing callers import this public component, type, or hook by name. */

export { ScrollArea, ScrollBar };
/* oxlint-enable import/no-named-export */
