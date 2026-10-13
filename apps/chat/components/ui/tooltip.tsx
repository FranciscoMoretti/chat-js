"use client";

import type {
  ComponentProps as ReactComponentProps,
  JSX as ReactJSX,
} from "react";
import {
  Arrow as TooltipPrimitiveArrow,
  Content as TooltipPrimitiveContent,
  Portal as TooltipPrimitivePortal,
  Provider as TooltipPrimitiveProvider,
  Root as TooltipPrimitiveRoot,
  Trigger as TooltipPrimitiveTrigger,
} from "@radix-ui/react-tooltip";
import type { ReadonlyReactNode } from "@/lib/readonly-react-node";
import { cn } from "@/lib/utils";

const DEFAULT_TOOLTIP_DELAY_DURATION = 0;
const DEFAULT_SIDE_OFFSET = 0;

const TooltipProvider = ({
  delayDuration = DEFAULT_TOOLTIP_DELAY_DURATION,
  ...props
}: Readonly<
  Omit<ReactComponentProps<typeof TooltipPrimitiveProvider>, "children">
> & { readonly children: ReadonlyReactNode }): ReactJSX.Element => (
  <TooltipPrimitiveProvider
    data-slot="tooltip-provider"
    delayDuration={delayDuration}
    {...props}
  />
);

const Tooltip = (
  props: Readonly<
    Omit<ReactComponentProps<typeof TooltipPrimitiveRoot>, "children">
  > & { readonly children?: ReadonlyReactNode }
): ReactJSX.Element => (
  <TooltipProvider>
    <TooltipPrimitiveRoot data-slot="tooltip" {...props} />
  </TooltipProvider>
);

const TooltipTrigger = (
  props: ReactComponentProps<typeof TooltipPrimitiveTrigger>
): ReactJSX.Element => (
  <TooltipPrimitiveTrigger data-slot="tooltip-trigger" {...props} />
);

const TooltipContent = ({
  className,
  sideOffset = DEFAULT_SIDE_OFFSET,
  children,
  variant = "primary",
  ...props
}: ReactComponentProps<typeof TooltipPrimitiveContent> & {
  readonly variant?: "base" | "primary";
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

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger };
