"use client";

import {
  Root as HoverCardPrimitiveRoot,
  Trigger as HoverCardPrimitiveTrigger,
  Content as HoverCardPrimitiveContent,
  Portal as HoverCardPrimitivePortal,
} from "@radix-ui/react-hover-card";
import type {
  ComponentProps as ReactComponentProps,
  JSX as ReactJSX,
} from "react";

import { cn } from "@/lib/utils";
/* oxlint-disable typescript/prefer-readonly-parameter-types -- HoverCard: typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

const HoverCard = ({
  ...props
}: ReactComponentProps<typeof HoverCardPrimitiveRoot>): ReactJSX.Element => (
  <HoverCardPrimitiveRoot data-slot="hover-card" {...props} />
);
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- HoverCardTrigger: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

const HoverCardTrigger = ({
  ...props
}: ReactComponentProps<typeof HoverCardPrimitiveTrigger>): ReactJSX.Element => (
  <HoverCardPrimitiveTrigger data-slot="hover-card-trigger" {...props} />
);
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable no-magic-numbers, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- HoverCardContent: no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 4); react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

const HoverCardContent = ({
  className,
  align = "center",
  sideOffset = 4,
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
/* oxlint-enable no-magic-numbers, react/no-multi-comp, typescript/prefer-readonly-parameter-types */

export { HoverCard, HoverCardContent, HoverCardTrigger };
