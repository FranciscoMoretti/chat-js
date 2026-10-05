import type { VariantProps } from "class-variance-authority";
import { cva } from "class-variance-authority";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type {
  ComponentProps as ReactComponentProps,
  JSX as ReactJSX,
} from "react";
/* oxlint-enable sort-imports */

import { cn } from "@/lib/utils";
/* oxlint-disable typescript/prefer-readonly-parameter-types -- Empty: typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: React.ComponentProps<"div">). */

/* oxlint-disable react/react-in-jsx-scope -- Empty uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
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
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward Empty's native div attributes, preserving caller events and accessibility props.
    {...props}
  />
);
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- EmptyHeader: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: React.ComponentProps<"div">). */

/* oxlint-disable react/react-in-jsx-scope -- EmptyHeader uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
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
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward EmptyHeader's native div attributes, preserving caller events and accessibility props.
    {...props}
  />
);
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

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
/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- EmptyMedia: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

/* oxlint-disable react/react-in-jsx-scope -- EmptyMedia uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
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
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward EmptyMedia's native div attributes, preserving caller events and accessibility props.
    {...props}
  />
);
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- EmptyTitle: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: React.ComponentProps<"div">). */

/* oxlint-disable react/react-in-jsx-scope -- EmptyTitle uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const EmptyTitle = ({
  className,
  ...props
}: ReactComponentProps<"div">): ReactJSX.Element => (
  <div
    className={cn("text-lg font-medium tracking-tight", className)}
    data-slot="empty-title"
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward EmptyTitle's native div attributes, preserving caller events and accessibility props.
    {...props}
  />
);
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- EmptyDescription: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: React.ComponentProps<"p">). */

/* oxlint-disable react/react-in-jsx-scope -- EmptyDescription uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
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
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward EmptyDescription's native div attributes, preserving caller events and accessibility props.
    {...props}
  />
);
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- EmptyContent: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: React.ComponentProps<"div">). */

/* oxlint-disable react/react-in-jsx-scope -- EmptyContent uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
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
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward EmptyContent's native div attributes, preserving caller events and accessibility props.
    {...props}
  />
);
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

export {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
};
/* oxlint-enable import/no-named-export */
