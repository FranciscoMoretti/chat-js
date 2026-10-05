import type { VariantProps } from "class-variance-authority";
import { cva } from "class-variance-authority";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type {
  HTMLAttributes as ReactHTMLAttributes,
  JSX as ReactJSX,
} from "react";
/* oxlint-enable sort-imports */

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

interface BadgeProps
  extends
    ReactHTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

/* oxlint-disable typescript/prefer-readonly-parameter-types -- Badge: typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, variant, ...props }: BadgeProps). */

/* oxlint-disable react/react-in-jsx-scope -- Badge uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const Badge = ({
  className,
  variant,
  // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className, variant from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
  ...props
}: BadgeProps): ReactJSX.Element => (
  <div
    className={cn(badgeVariants({ variant }), className)}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward Badge's native div attributes, preserving caller events and accessibility props.
    {...props}
  />
);
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (Badge, badgeVariants); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable typescript/prefer-readonly-parameter-types */

/* oxlint-disable react/only-export-components -- #620: Consumers import Badge, badgeVariants from this existing mixed component, context, or helper API; separating the Fast Refresh boundary remains tracked review debt. */
export { Badge, badgeVariants };
/* oxlint-enable import/no-named-export */
/* oxlint-disable import/no-named-export -- Keep the named type bindings (BadgeProps); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable react/only-export-components */
export type { BadgeProps };
/* oxlint-enable import/no-named-export */
