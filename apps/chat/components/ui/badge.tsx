import { cva } from "class-variance-authority";
import type { VariantProps } from "class-variance-authority";
/* oxlint-disable import/no-namespace -- react import: import/no-namespace: the React or primitive namespace carries the library component and type contract. */
import type * as React from "react";
/* oxlint-enable import/no-namespace */

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "focus:ring-ring inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:ring-2 focus:ring-offset-2 focus:outline-none",
  {
    defaultVariants: {
      variant: "default",
    },
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-primary/80 border-transparent",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/80 border-transparent",
        outline: "text-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80 border-transparent",
      },
    },
  }
);
/* oxlint-disable import/exports-last -- BadgeProps: import/exports-last: keep this public declaration beside its implementation so its props and behavior remain reviewable together;  */

export interface BadgeProps
  extends
    React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}
/* oxlint-enable import/exports-last */

/* oxlint-disable react/jsx-props-no-spreading, typescript/prefer-readonly-parameter-types -- Badge: react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, variant, ...props }: BadgeProps). */

const Badge = ({
  className,
  variant,
  ...props
}: BadgeProps): React.JSX.Element => (
  <div className={cn(badgeVariants({ variant }), className)} {...props} />
);
/* oxlint-enable react/jsx-props-no-spreading, typescript/prefer-readonly-parameter-types */
/* oxlint-disable react/only-export-components -- badge.tsx exports: react/only-export-components: consumers also import the associated type, variants, or helper from this established module API. */

export { Badge, badgeVariants };
/* oxlint-enable react/only-export-components */
