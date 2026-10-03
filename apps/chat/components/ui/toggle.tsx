"use client";

/* oxlint-disable import/no-namespace -- @radix-ui/react-toggle import: import/no-namespace: the React or primitive namespace carries the library component and type contract. */

import * as TogglePrimitive from "@radix-ui/react-toggle";
/* oxlint-enable import/no-namespace */
import { cva } from "class-variance-authority";
import type { VariantProps } from "class-variance-authority";
/* oxlint-disable import/no-namespace -- react import: import/no-namespace: the React or primitive namespace carries the library component and type contract. */
import type * as React from "react";
/* oxlint-enable import/no-namespace */

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
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-disable react/only-export-components -- toggle.tsx exports: react/only-export-components: consumers also import the associated type, variants, or helper from this established module API. */

export { Toggle, toggleVariants };
/* oxlint-enable react/only-export-components */
