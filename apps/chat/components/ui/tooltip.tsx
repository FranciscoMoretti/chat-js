"use client";
/* oxlint-disable sort-imports -- Oxfmt owns this module's external, type-only, and alias import groups; its case-insensitive order conflicts with this declaration-order rule. */

/* oxlint-disable import/no-namespace -- @radix-ui/react-tooltip import: import/no-namespace: the React or primitive namespace carries the library component and type contract. */

import * as TooltipPrimitive from "@radix-ui/react-tooltip";
/* oxlint-enable import/no-namespace */
/* oxlint-disable import/no-namespace -- react import: import/no-namespace: the React or primitive namespace carries the library component and type contract. */
import type * as React from "react";
/* oxlint-enable import/no-namespace */

import { cn } from "@/lib/utils";
/* oxlint-enable sort-imports */
/* oxlint-disable no-magic-numbers, oxc/no-rest-spread-properties, react/jsx-props-no-spreading, typescript/prefer-readonly-parameter-types -- TooltipProvider: no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 0); oxc/no-rest-spread-properties: compose immutable state or forward the remaining typed props without mutating the caller object; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

const TooltipProvider = ({
  delayDuration = 0,
  ...props
}: React.ComponentProps<
  typeof TooltipPrimitive.Provider
>): React.JSX.Element => (
  <TooltipPrimitive.Provider
    data-slot="tooltip-provider"
    delayDuration={delayDuration}
    {...props}
  />
);
/* oxlint-enable no-magic-numbers, oxc/no-rest-spread-properties, react/jsx-props-no-spreading, typescript/prefer-readonly-parameter-types */
/* oxlint-disable oxc/no-rest-spread-properties, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- Tooltip: oxc/no-rest-spread-properties: compose immutable state or forward the remaining typed props without mutating the caller object; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

const Tooltip = ({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Root>): React.JSX.Element => (
  <TooltipProvider>
    <TooltipPrimitive.Root data-slot="tooltip" {...props} />
  </TooltipProvider>
);
/* oxlint-enable oxc/no-rest-spread-properties, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable oxc/no-rest-spread-properties, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- TooltipTrigger: oxc/no-rest-spread-properties: compose immutable state or forward the remaining typed props without mutating the caller object; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

const TooltipTrigger = ({
  ...props
}: React.ComponentProps<
  typeof TooltipPrimitive.Trigger
>): React.JSX.Element => (
  <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />
);
/* oxlint-enable oxc/no-rest-spread-properties, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable no-magic-numbers, oxc/no-rest-spread-properties, react/forbid-component-props, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- TooltipContent: no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 0); oxc/no-rest-spread-properties: compose immutable state or forward the remaining typed props without mutating the caller object; react/forbid-component-props: className and style are the existing Tailwind and primitive composition API; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

const TooltipContent = ({
  className,
  sideOffset = 0,
  children,
  variant = "primary",
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content> & {
  variant?: "base" | "primary";
}): React.JSX.Element => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      className={cn(
        "fade-in-0 zoom-in-95 data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 animate-in data-[state=closed]:animate-out z-50 w-fit origin-(--radix-tooltip-content-transform-origin) rounded-md px-3 py-1.5 text-xs text-balance",
        variant === "primary" && "bg-primary text-primary-foreground",
        variant === "base" && "bg-popover text-popover-foreground",
        className
      )}
      data-slot="tooltip-content"
      sideOffset={sideOffset}
      {...props}
    >
      {children}
      <TooltipPrimitive.Arrow
        className={cn(
          "z-50 size-2.5 translate-y-[calc(-50%_-_2px)] rotate-45 rounded-[2px]",
          variant === "primary" && "bg-primary fill-primary",
          variant === "base" && "bg-popover fill-popover"
        )}
      />
    </TooltipPrimitive.Content>
  </TooltipPrimitive.Portal>
);
/* oxlint-enable no-magic-numbers, oxc/no-rest-spread-properties, react/forbid-component-props, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/no-named-export -- tooltip.tsx exports: import/no-named-export: existing callers import this public component, type, or hook by name. */

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger };
/* oxlint-enable import/no-named-export */
