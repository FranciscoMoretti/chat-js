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

import type { ReadonlyReactNode } from "@/lib/readonly-react-node";
import { cn } from "@/lib/utils";

const DEFAULT_SIDE_OFFSET = 4;

const Popover = (
  props: Readonly<
    Omit<ReactComponentProps<typeof PopoverPrimitiveRoot>, "children">
  > & { readonly children?: ReadonlyReactNode }
): ReactJSX.Element => <PopoverPrimitiveRoot data-slot="popover" {...props} />;

const PopoverTrigger = (
  props: ReactComponentProps<typeof PopoverPrimitiveTrigger>
): ReactJSX.Element => (
  <PopoverPrimitiveTrigger data-slot="popover-trigger" {...props} />
);

const PopoverContent = ({
  className,
  align = "center",
  sideOffset = DEFAULT_SIDE_OFFSET,
  ...props
}: ReactComponentProps<typeof PopoverPrimitiveContent>): ReactJSX.Element => (
  <PopoverPrimitivePortal>
    <PopoverPrimitiveContent
      align={align}
      className={cn(
        "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 bg-popover text-popover-foreground data-[state=closed]:animate-out data-[state=open]:animate-in z-50 w-72 origin-(--radix-popover-content-transform-origin) rounded-md border p-4 shadow-md outline-hidden",
        className
      )}
      data-slot="popover-content"
      sideOffset={sideOffset}
      {...props}
    />
  </PopoverPrimitivePortal>
);

const PopoverAnchor = (
  props: ReactComponentProps<typeof PopoverPrimitiveAnchor>
): ReactJSX.Element => (
  <PopoverPrimitiveAnchor data-slot="popover-anchor" {...props} />
);

export { Popover, PopoverAnchor, PopoverContent, PopoverTrigger };
