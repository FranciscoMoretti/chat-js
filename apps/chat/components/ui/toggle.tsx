"use client";

import { Root as TogglePrimitiveRoot } from "@radix-ui/react-toggle";
import type { VariantProps } from "class-variance-authority";
import { cva } from "class-variance-authority";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type {
  ComponentProps as ReactComponentProps,
  JSX as ReactJSX,
} from "react";
/* oxlint-enable sort-imports */

import { cn } from "@/lib/utils";

const toggleVariants = cva(
  "hover:bg-muted hover:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 data-[state=on]:bg-accent data-[state=on]:text-accent-foreground dark:aria-invalid:ring-destructive/40 inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    defaultVariants: { size: "default", variant: "default" },
    variants: {
      size: {
        default: "h-9 min-w-9 px-2",
        lg: "h-10 min-w-10 px-2.5",
        sm: "h-8 min-w-8 px-1.5",
      },
      variant: {
        default: "bg-transparent",
        outline:
          "border-input hover:bg-accent hover:text-accent-foreground border bg-transparent shadow-xs",
      },
    },
  }
);
/* oxlint-disable typescript/prefer-readonly-parameter-types -- Toggle: typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

/* oxlint-disable react/react-in-jsx-scope -- Toggle uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const Toggle = ({
  className,
  variant,
  size,
  // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className, variant, size from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
  ...props
}: ReactComponentProps<typeof TogglePrimitiveRoot> &
  VariantProps<typeof toggleVariants>): ReactJSX.Element => (
  <TogglePrimitiveRoot
    // oxlint-disable-next-line react/forbid-component-props -- TogglePrimitiveRoot accepts className in its styling contract; preserve this caller's layout and appearance.
    className={cn(toggleVariants({ className, size, variant }))}
    data-slot="toggle"
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward Toggle's TogglePrimitiveRoot prop contract, preserving caller options, children and callbacks.
    {...props}
  />
);
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (Toggle, toggleVariants); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-disable react/only-export-components -- toggle.tsx exports: react/only-export-components: consumers also import the associated type, variants, or helper from this established module API. */

export { Toggle, toggleVariants };
/* oxlint-enable import/no-named-export */
/* oxlint-enable react/only-export-components */
