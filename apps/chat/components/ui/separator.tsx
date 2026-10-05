"use client";

import { Root as SeparatorPrimitiveRoot } from "@radix-ui/react-separator";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type {
  ComponentProps as ReactComponentProps,
  JSX as ReactJSX,
} from "react";
/* oxlint-enable sort-imports */

import { cn } from "@/lib/utils";

/* oxlint-disable react/react-in-jsx-scope -- Separator uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const Separator = (
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Separator forwards Radix SeparatorPrimitiveRoot native div refs (including writable current), CSSProperties, children and TrustedHTML; React autoCapitalize/role include open string & {} aliases flagged even with top-level Readonly.
  {
    className,
    orientation = "horizontal",
    decorative = true,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className, orientation, decorative from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    ...props
  }: ReactComponentProps<typeof SeparatorPrimitiveRoot>
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
