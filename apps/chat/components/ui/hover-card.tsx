"use client";

import {
  Content as HoverCardPrimitiveContent,
  Portal as HoverCardPrimitivePortal,
  Root as HoverCardPrimitiveRoot,
  Trigger as HoverCardPrimitiveTrigger,
} from "@radix-ui/react-hover-card";
import type {
  ComponentProps as ReactComponentProps,
  JSX as ReactJSX,
} from "react";

import type { ReadonlyReactNode } from "@/lib/readonly-react-node";
import { cn } from "@/lib/utils";

const DEFAULT_SIDE_OFFSET = 4;

const HoverCard = (
  props: Readonly<
    Omit<ReactComponentProps<typeof HoverCardPrimitiveRoot>, "children">
  > & { readonly children?: ReadonlyReactNode }
): ReactJSX.Element => (
  <HoverCardPrimitiveRoot data-slot="hover-card" {...props} />
);

const HoverCardTrigger = (
  props: ReactComponentProps<typeof HoverCardPrimitiveTrigger>
): ReactJSX.Element => (
  <HoverCardPrimitiveTrigger data-slot="hover-card-trigger" {...props} />
);

const HoverCardContent = ({
  className,
  align = "center",
  sideOffset = DEFAULT_SIDE_OFFSET,
  ...props
}: ReactComponentProps<typeof HoverCardPrimitiveContent>): ReactJSX.Element => (
  <HoverCardPrimitivePortal data-slot="hover-card-portal">
    <HoverCardPrimitiveContent
      align={align}
      className={cn(
        "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 bg-popover text-popover-foreground data-[state=closed]:animate-out data-[state=open]:animate-in z-50 w-64 origin-(--radix-hover-card-content-transform-origin) rounded-md border p-4 shadow-md outline-hidden",
        className
      )}
      data-slot="hover-card-content"
      sideOffset={sideOffset}
      {...props}
    />
  </HoverCardPrimitivePortal>
);

export { HoverCard, HoverCardContent, HoverCardTrigger };
