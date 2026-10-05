"use client";

import { Root as SeparatorPrimitiveRoot } from "@radix-ui/react-separator";
import type {
  ComponentProps as ReactComponentProps,
  JSX as ReactJSX,
} from "react";

import { cn } from "@/lib/utils";
/* oxlint-disable typescript/prefer-readonly-parameter-types -- Separator: typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

/* oxlint-disable react/react-in-jsx-scope -- Separator uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
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
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward Separator's SeparatorPrimitiveRoot prop contract, preserving caller options, children and callbacks.
    {...props}
  />
);
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable typescript/prefer-readonly-parameter-types */

export { Separator };
