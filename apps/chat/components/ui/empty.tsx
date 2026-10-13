import type {
  ComponentProps as ReactComponentProps,
  JSX as ReactJSX,
} from "react";
import type { VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { cva } from "class-variance-authority";

const Empty = ({
  className,
  ...props
}: ReactComponentProps<"div">): ReactJSX.Element => (
  <div
    className={cn(
      "flex min-w-0 flex-1 flex-col items-center justify-center gap-6 rounded-lg border-dashed p-6 text-center text-balance md:p-12",
      className
    )}
    data-slot="empty"
    {...props}
  />
);

const EmptyHeader = ({
  className,
  ...props
}: ReactComponentProps<"div">): ReactJSX.Element => (
  <div
    className={cn(
      "flex max-w-sm flex-col items-center gap-2 text-center",
      className
    )}
    data-slot="empty-header"
    {...props}
  />
);

const emptyMediaVariants = cva(
  "mb-2 flex shrink-0 items-center justify-center [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    defaultVariants: {
      variant: "default",
    },
    variants: {
      variant: {
        default: "bg-transparent",
        icon: "bg-muted text-foreground flex size-10 shrink-0 items-center justify-center rounded-lg [&_svg:not([class*='size-'])]:size-6",
      },
    },
  }
);

const EmptyMedia = ({
  className,
  variant = "default",
  ...props
}: ReactComponentProps<"div"> &
  VariantProps<typeof emptyMediaVariants>): ReactJSX.Element => (
  <div
    className={cn(emptyMediaVariants({ className, variant }))}
    data-slot="empty-icon"
    data-variant={variant}
    {...props}
  />
);

const EmptyTitle = ({
  className,
  ...props
}: ReactComponentProps<"div">): ReactJSX.Element => (
  <div
    className={cn("text-lg font-medium tracking-tight", className)}
    data-slot="empty-title"
    {...props}
  />
);

const EmptyDescription = ({
  className,
  ...props
}: ReactComponentProps<"p">): ReactJSX.Element => (
  <div
    className={cn(
      "text-muted-foreground [&>a:hover]:text-primary text-sm/relaxed [&>a]:underline [&>a]:underline-offset-4",
      className
    )}
    data-slot="empty-description"
    {...props}
  />
);

const EmptyContent = ({
  className,
  ...props
}: ReactComponentProps<"div">): ReactJSX.Element => (
  <div
    className={cn(
      "flex w-full max-w-sm min-w-0 flex-col items-center gap-4 text-sm text-balance",
      className
    )}
    data-slot="empty-content"
    {...props}
  />
);

export {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
};
