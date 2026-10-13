import type {
  HTMLAttributes as ReactHTMLAttributes,
  JSX as ReactJSX,
} from "react";
import type { VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { cva } from "class-variance-authority";

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

const Badge = ({
  className,
  variant,
  ...props
}: BadgeProps): ReactJSX.Element => (
  <div className={cn(badgeVariants({ variant }), className)} {...props} />
);

export { Badge };
