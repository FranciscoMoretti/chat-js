"use client";
/* oxlint-disable sort-imports -- Oxfmt owns this module's external, type-only, and alias import groups; its case-insensitive order conflicts with this declaration-order rule. */

/* oxlint-disable import/no-namespace -- @radix-ui/react-toggle import: import/no-namespace: the React or primitive namespace carries the library component and type contract. */

import * as TogglePrimitive from "@radix-ui/react-toggle";
/* oxlint-enable import/no-namespace */
import { cva } from "class-variance-authority";
import type { VariantProps } from "class-variance-authority";
/* oxlint-disable import/no-namespace -- react import: import/no-namespace: the React or primitive namespace carries the library component and type contract. */
import type * as React from "react";
/* oxlint-enable import/no-namespace */

import { cn } from "@/lib/utils";
/* oxlint-enable sort-imports */

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
/* oxlint-disable oxc/no-rest-spread-properties, react/forbid-component-props, react/jsx-props-no-spreading, typescript/prefer-readonly-parameter-types -- Toggle: oxc/no-rest-spread-properties: compose immutable state or forward the remaining typed props without mutating the caller object; react/forbid-component-props: className and style are the existing Tailwind and primitive composition API; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

const Toggle = ({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<typeof TogglePrimitive.Root> &
  VariantProps<typeof toggleVariants>): React.JSX.Element => (
  <TogglePrimitive.Root
    className={cn(toggleVariants({ className, size, variant }))}
    data-slot="toggle"
    {...props}
  />
);
/* oxlint-enable oxc/no-rest-spread-properties, react/forbid-component-props, react/jsx-props-no-spreading, typescript/prefer-readonly-parameter-types */
/* oxlint-disable import/no-named-export, react/only-export-components -- toggle.tsx exports: import/no-named-export: existing callers import this public component, type, or hook by name; react/only-export-components: consumers also import the associated type, variants, or helper from this established module API. */

export { Toggle, toggleVariants };
/* oxlint-enable import/no-named-export, react/only-export-components */
