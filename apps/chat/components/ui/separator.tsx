"use client";

import type {
  ComponentProps as ReactComponentProps,
  JSX as ReactJSX,
} from "react";
import { Root as SeparatorPrimitiveRoot } from "@radix-ui/react-separator";
import { cn } from "@/lib/utils";

const Separator = ({
  className,
  orientation = "horizontal",
  decorative = true,
  ...props
}: ReactComponentProps<typeof SeparatorPrimitiveRoot>): ReactJSX.Element => (
  <SeparatorPrimitiveRoot
    className={cn(
      "bg-border shrink-0 data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-px",
      className
    )}
    data-slot="separator"
    decorative={decorative}
    orientation={orientation}
    {...props}
  />
);

export { Separator };
