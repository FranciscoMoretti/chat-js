"use client";

import {
  Anchor as PopoverPrimitiveAnchor,
  Content as PopoverPrimitiveContent,
  Portal as PopoverPrimitivePortal,
  Root as PopoverPrimitiveRoot,
  Trigger as PopoverPrimitiveTrigger,
} from "@radix-ui/react-popover";
import type {
  ComponentProps as ReactComponentProps,
  JSX as ReactJSX,
} from "react";

import { cn } from "@/lib/utils";
/* oxlint-disable typescript/prefer-readonly-parameter-types -- Popover: typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

/* oxlint-disable react/react-in-jsx-scope -- Popover uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const Popover = ({
  ...props
}: ReactComponentProps<typeof PopoverPrimitiveRoot>): ReactJSX.Element => (
  <PopoverPrimitiveRoot
    data-slot="popover"
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward Popover's PopoverPrimitiveRoot prop contract, preserving caller options, children and callbacks.
    {...props}
  />
);
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- PopoverTrigger: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

/* oxlint-disable react/react-in-jsx-scope -- PopoverTrigger uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const PopoverTrigger = ({
  ...props
}: ReactComponentProps<typeof PopoverPrimitiveTrigger>): ReactJSX.Element => (
  <PopoverPrimitiveTrigger
    data-slot="popover-trigger"
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward PopoverTrigger's PopoverPrimitiveTrigger prop contract, preserving caller options, children and callbacks.
    {...props}
  />
);
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable no-magic-numbers, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- PopoverContent: no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 4); react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

/* oxlint-disable react/react-in-jsx-scope -- PopoverContent uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const PopoverContent = ({
  className,
  align = "center",
  sideOffset = 4,
  ...props
}: ReactComponentProps<typeof PopoverPrimitiveContent>): ReactJSX.Element => (
  <PopoverPrimitivePortal>
    <PopoverPrimitiveContent
      align={align}
      // oxlint-disable-next-line react/forbid-component-props -- PopoverPrimitiveContent accepts className in its styling contract; preserve this caller's layout and appearance.
      className={cn(
        "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 bg-popover text-popover-foreground data-[state=closed]:animate-out data-[state=open]:animate-in z-50 w-72 origin-(--radix-popover-content-transform-origin) rounded-md border p-4 shadow-md outline-hidden",
        className
      )}
      data-slot="popover-content"
      sideOffset={sideOffset}
      // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward PopoverContent's PopoverPrimitiveContent prop contract, preserving caller options, children and callbacks.
      {...props}
    />
  </PopoverPrimitivePortal>
);
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable no-magic-numbers, react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- PopoverAnchor: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

/* oxlint-disable react/react-in-jsx-scope -- PopoverAnchor uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const PopoverAnchor = ({
  ...props
}: ReactComponentProps<typeof PopoverPrimitiveAnchor>): ReactJSX.Element => (
  <PopoverPrimitiveAnchor
    data-slot="popover-anchor"
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward PopoverAnchor's PopoverPrimitiveAnchor prop contract, preserving caller options, children and callbacks.
    {...props}
  />
);
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

export { Popover, PopoverAnchor, PopoverContent, PopoverTrigger };
