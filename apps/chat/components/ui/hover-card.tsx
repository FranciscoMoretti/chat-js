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

/* oxlint-disable react/react-in-jsx-scope -- HoverCard uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const HoverCard = (
  props: Readonly<
    Omit<ReactComponentProps<typeof HoverCardPrimitiveRoot>, "children">
  > & { readonly children?: ReadonlyReactNode }
): ReactJSX.Element => (
  <HoverCardPrimitiveRoot
    data-slot="hover-card"
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward HoverCard's HoverCardPrimitiveRoot prop contract, preserving caller options, children and callbacks.
    {...props}
  />
);
/* oxlint-enable react/react-in-jsx-scope */

/* oxlint-disable react/no-multi-comp -- HoverCardTrigger: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract. */

/* oxlint-disable react/react-in-jsx-scope -- HoverCardTrigger uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const HoverCardTrigger = (
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- Forwards the original native element or primitive props, including ref/event callbacks and component constructors; their exact callable and DOM contracts remain flagged by the faithful readonly rule control. */
  props: ReactComponentProps<typeof HoverCardPrimitiveTrigger>
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
): ReactJSX.Element => (
  <HoverCardPrimitiveTrigger
    data-slot="hover-card-trigger"
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward HoverCardTrigger's HoverCardPrimitiveTrigger prop contract, preserving caller options, children and callbacks.
    {...props}
  />
);
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable react/no-multi-comp */

/* oxlint-disable no-magic-numbers, react/no-multi-comp -- HoverCardContent: no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 4); react/no-multi-comp: these related render helpers share this feature module and its local state and props contract. */

/* oxlint-disable react/react-in-jsx-scope -- HoverCardContent uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */

const HoverCardContent = (
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- Forwards the original native element or primitive props, including ref/event callbacks and component constructors; their exact callable and DOM contracts remain flagged by the faithful readonly rule control. */
  {
    className,
    align = "center",
    sideOffset = 4,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className, align, sideOffset from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    ...props
  }: ReactComponentProps<typeof HoverCardPrimitiveContent>
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
): ReactJSX.Element => (
  <HoverCardPrimitivePortal data-slot="hover-card-portal">
    <HoverCardPrimitiveContent
      align={align}
      // oxlint-disable-next-line react/forbid-component-props -- HoverCardPrimitiveContent accepts className in its styling contract; preserve this caller's layout and appearance.
      className={cn(
        "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 bg-popover text-popover-foreground data-[state=closed]:animate-out data-[state=open]:animate-in z-50 w-64 origin-(--radix-hover-card-content-transform-origin) rounded-md border p-4 shadow-md outline-hidden",
        className
      )}
      data-slot="hover-card-content"
      sideOffset={sideOffset}
      // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward HoverCardContent's HoverCardPrimitiveContent prop contract, preserving caller options, children and callbacks.
      {...props}
    />
  </HoverCardPrimitivePortal>
);
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (HoverCard, HoverCardContent, HoverCardTrigger); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable no-magic-numbers, react/no-multi-comp */

export { HoverCard, HoverCardContent, HoverCardTrigger };
/* oxlint-enable import/no-named-export */
