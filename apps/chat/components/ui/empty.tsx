/* oxlint-disable sort-imports -- Oxfmt owns this module's external, type-only, and alias import groups; its case-insensitive order conflicts with this declaration-order rule. */

import { cva } from "class-variance-authority";
import type { VariantProps } from "class-variance-authority";
/* oxlint-disable import/no-namespace -- react import: import/no-namespace: the React or primitive namespace carries the library component and type contract. */
import type * as React from "react";
/* oxlint-enable import/no-namespace */

import { cn } from "@/lib/utils";
/* oxlint-enable sort-imports */
/* oxlint-disable oxc/no-rest-spread-properties, react/jsx-props-no-spreading, typescript/prefer-readonly-parameter-types -- Empty: oxc/no-rest-spread-properties: compose immutable state or forward the remaining typed props without mutating the caller object; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: React.ComponentProps<"div">). */

const Empty = ({
  className,
  ...props
}: React.ComponentProps<"div">): React.JSX.Element => (
  <div
    className={cn(
      "flex min-w-0 flex-1 flex-col items-center justify-center gap-6 rounded-lg border-dashed p-6 text-center text-balance md:p-12",
      className
    )}
    data-slot="empty"
    {...props}
  />
);
/* oxlint-enable oxc/no-rest-spread-properties, react/jsx-props-no-spreading, typescript/prefer-readonly-parameter-types */
/* oxlint-disable oxc/no-rest-spread-properties, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- EmptyHeader: oxc/no-rest-spread-properties: compose immutable state or forward the remaining typed props without mutating the caller object; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: React.ComponentProps<"div">). */

const EmptyHeader = ({
  className,
  ...props
}: React.ComponentProps<"div">): React.JSX.Element => (
  <div
    className={cn(
      "flex max-w-sm flex-col items-center gap-2 text-center",
      className
    )}
    data-slot="empty-header"
    {...props}
  />
);
/* oxlint-enable oxc/no-rest-spread-properties, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types */

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
/* oxlint-disable oxc/no-rest-spread-properties, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- EmptyMedia: oxc/no-rest-spread-properties: compose immutable state or forward the remaining typed props without mutating the caller object; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

const EmptyMedia = ({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<"div"> &
  VariantProps<typeof emptyMediaVariants>): React.JSX.Element => (
  <div
    className={cn(emptyMediaVariants({ className, variant }))}
    data-slot="empty-icon"
    data-variant={variant}
    {...props}
  />
);
/* oxlint-enable oxc/no-rest-spread-properties, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable oxc/no-rest-spread-properties, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- EmptyTitle: oxc/no-rest-spread-properties: compose immutable state or forward the remaining typed props without mutating the caller object; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: React.ComponentProps<"div">). */

const EmptyTitle = ({
  className,
  ...props
}: React.ComponentProps<"div">): React.JSX.Element => (
  <div
    className={cn("text-lg font-medium tracking-tight", className)}
    data-slot="empty-title"
    {...props}
  />
);
/* oxlint-enable oxc/no-rest-spread-properties, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable oxc/no-rest-spread-properties, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- EmptyDescription: oxc/no-rest-spread-properties: compose immutable state or forward the remaining typed props without mutating the caller object; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: React.ComponentProps<"p">). */

const EmptyDescription = ({
  className,
  ...props
}: React.ComponentProps<"p">): React.JSX.Element => (
  <div
    className={cn(
      "text-muted-foreground [&>a:hover]:text-primary text-sm/relaxed [&>a]:underline [&>a]:underline-offset-4",
      className
    )}
    data-slot="empty-description"
    {...props}
  />
);
/* oxlint-enable oxc/no-rest-spread-properties, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable oxc/no-rest-spread-properties, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- EmptyContent: oxc/no-rest-spread-properties: compose immutable state or forward the remaining typed props without mutating the caller object; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: React.ComponentProps<"div">). */

const EmptyContent = ({
  className,
  ...props
}: React.ComponentProps<"div">): React.JSX.Element => (
  <div
    className={cn(
      "flex w-full max-w-sm min-w-0 flex-col items-center gap-4 text-sm text-balance",
      className
    )}
    data-slot="empty-content"
    {...props}
  />
);
/* oxlint-enable oxc/no-rest-spread-properties, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/no-named-export -- empty.tsx exports: import/no-named-export: existing callers import this public component, type, or hook by name. */

export {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
};
/* oxlint-enable import/no-named-export */
