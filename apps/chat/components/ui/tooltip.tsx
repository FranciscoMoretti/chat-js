"use client";

import {
  Provider as TooltipPrimitiveProvider,
  Root as TooltipPrimitiveRoot,
  Trigger as TooltipPrimitiveTrigger,
  Content as TooltipPrimitiveContent,
  Portal as TooltipPrimitivePortal,
  Arrow as TooltipPrimitiveArrow,
} from "@radix-ui/react-tooltip";
import type {
  ComponentProps as ReactComponentProps,
  JSX as ReactJSX,
} from "react";

import { cn } from "@/lib/utils";
/* oxlint-disable no-magic-numbers, typescript/prefer-readonly-parameter-types -- TooltipProvider: no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 0); typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

const TooltipProvider = ({
  delayDuration = 0,
  ...props
}: ReactComponentProps<typeof TooltipPrimitiveProvider>): ReactJSX.Element => (
  <TooltipPrimitiveProvider
    data-slot="tooltip-provider"
    delayDuration={delayDuration}
    {...props}
  />
);
/* oxlint-enable no-magic-numbers, typescript/prefer-readonly-parameter-types */
/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- Tooltip: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

const Tooltip = ({
  ...props
}: ReactComponentProps<typeof TooltipPrimitiveRoot>): ReactJSX.Element => (
  <TooltipProvider>
    <TooltipPrimitiveRoot data-slot="tooltip" {...props} />
  </TooltipProvider>
);
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- TooltipTrigger: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

const TooltipTrigger = ({
  ...props
}: ReactComponentProps<typeof TooltipPrimitiveTrigger>): ReactJSX.Element => (
  <TooltipPrimitiveTrigger data-slot="tooltip-trigger" {...props} />
);
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable no-magic-numbers, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- TooltipContent: no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 0); react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

const TooltipContent = ({
  className,
  sideOffset = 0,
  children,
  variant = "primary",
  ...props
}: ReactComponentProps<typeof TooltipPrimitiveContent> & {
  variant?: "base" | "primary";
}): ReactJSX.Element => (
  <TooltipPrimitivePortal>
    <TooltipPrimitiveContent
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
      <TooltipPrimitiveArrow
        className={cn(
          "z-50 size-2.5 translate-y-[calc(-50%_-_2px)] rotate-45 rounded-[2px]",
          variant === "primary" && "bg-primary fill-primary",
          variant === "base" && "bg-popover fill-popover"
        )}
      />
    </TooltipPrimitiveContent>
  </TooltipPrimitivePortal>
);
/* oxlint-enable no-magic-numbers, react/no-multi-comp, typescript/prefer-readonly-parameter-types */

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger };
