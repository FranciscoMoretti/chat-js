import { Slot } from "@radix-ui/react-slot";
import type { VariantProps } from "class-variance-authority";
import { cva } from "class-variance-authority";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type {
  ComponentProps as ReactComponentProps,
  JSX as ReactJSX,
} from "react";
/* oxlint-enable sort-imports */

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-all outline-none focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    defaultVariants: { size: "default", variant: "default" },
    variants: {
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        icon: "size-9",
        "icon-lg": "size-10",
        "icon-sm": "size-8",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        sm: "h-8 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5",
      },
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:bg-destructive/60 dark:focus-visible:ring-destructive/40 text-white",
        ghost:
          "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
        link: "text-primary underline-offset-4 hover:underline",
        outline:
          "bg-background hover:bg-accent hover:text-accent-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50 border shadow-xs",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
      },
    },
  }
);

/* oxlint-disable react/react-in-jsx-scope -- Button uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Forward the standard React button props to the button or Radix Slot, including native object refs. Deep readonly ref.current fails their JSX receiver; preserving React/CSS string & {} aliases still triggers this rule.
const Button = ({
  className,
  variant,
  size,
  asChild = false,
  // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className, variant, size, asChild from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
  ...props
}: ReactComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }): ReactJSX.Element => {
  // oxlint-disable-next-line no-ternary -- Keep Comp as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      // oxlint-disable-next-line react/forbid-component-props -- Comp accepts className in its styling contract; preserve this caller's layout and appearance.
      className={cn(buttonVariants({ className, size, variant }))}
      data-slot="button"
      // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward Button's Comp prop contract, preserving caller options, children and callbacks.
      {...props}
    />
  );
};
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (Button, buttonVariants); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-disable react/only-export-components -- button.tsx exports: react/only-export-components: consumers also import the associated type, variants, or helper from this established module API. */

export { Button, buttonVariants };
/* oxlint-enable import/no-named-export */
/* oxlint-enable react/only-export-components */
