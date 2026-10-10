"use client";

import type {
  ComponentProps as ReactComponentProps,
  JSX as ReactJSX,
} from "react";
import { Root as SeparatorPrimitiveRoot } from "@radix-ui/react-separator";
import { cn } from "@/lib/utils";

/* oxlint-disable react/react-in-jsx-scope -- Separator uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const Separator = (
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- Forwards the original native element or primitive props, including ref/event callbacks and component constructors; their exact callable and DOM contracts remain flagged by the faithful readonly rule control. */
  {
    className,
    orientation = "horizontal",
    decorative = true,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className, orientation, decorative from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    ...props
  }: ReactComponentProps<typeof SeparatorPrimitiveRoot>
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
): ReactJSX.Element => (
  <SeparatorPrimitiveRoot
    // oxlint-disable-next-line react/forbid-component-props -- SeparatorPrimitiveRoot accepts className in its styling contract; preserve this caller's layout and appearance.
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
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (Separator); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable react/react-in-jsx-scope */

export { Separator };
/* oxlint-enable import/prefer-default-export, import/no-named-export */
