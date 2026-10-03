/* oxlint-disable import/no-namespace -- react import: import/no-namespace: the React or primitive namespace carries the library component and type contract. */
import type * as React from "react";
/* oxlint-enable import/no-namespace */

import { cn } from "@/lib/utils";
/* oxlint-disable oxc/no-rest-spread-properties, react/jsx-props-no-spreading, typescript/prefer-readonly-parameter-types -- Card: oxc/no-rest-spread-properties: compose immutable state or forward the remaining typed props without mutating the caller object; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: React.ComponentProps<"div">). */

const Card = ({
  className,
  ...props
}: React.ComponentProps<"div">): React.JSX.Element => (
  <div
    className={cn(
      "bg-card text-card-foreground flex flex-col gap-6 rounded-xl border py-6 shadow-sm",
      className
    )}
    data-slot="card"
    {...props}
  />
);
/* oxlint-enable oxc/no-rest-spread-properties, react/jsx-props-no-spreading, typescript/prefer-readonly-parameter-types */
/* oxlint-disable oxc/no-rest-spread-properties, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- CardHeader: oxc/no-rest-spread-properties: compose immutable state or forward the remaining typed props without mutating the caller object; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: React.ComponentProps<"div">). */

const CardHeader = ({
  className,
  ...props
}: React.ComponentProps<"div">): React.JSX.Element => (
  <div
    className={cn(
      "@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-1.5 px-6 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6",
      className
    )}
    data-slot="card-header"
    {...props}
  />
);
/* oxlint-enable oxc/no-rest-spread-properties, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable oxc/no-rest-spread-properties, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- CardTitle: oxc/no-rest-spread-properties: compose immutable state or forward the remaining typed props without mutating the caller object; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: React.ComponentProps<"div">). */

const CardTitle = ({
  className,
  ...props
}: React.ComponentProps<"div">): React.JSX.Element => (
  <div
    className={cn("leading-none font-semibold", className)}
    data-slot="card-title"
    {...props}
  />
);
/* oxlint-enable oxc/no-rest-spread-properties, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable oxc/no-rest-spread-properties, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- CardDescription: oxc/no-rest-spread-properties: compose immutable state or forward the remaining typed props without mutating the caller object; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: React.ComponentProps<"div">). */

const CardDescription = ({
  className,
  ...props
}: React.ComponentProps<"div">): React.JSX.Element => (
  <div
    className={cn("text-muted-foreground text-sm", className)}
    data-slot="card-description"
    {...props}
  />
);
/* oxlint-enable oxc/no-rest-spread-properties, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable oxc/no-rest-spread-properties, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- CardAction: oxc/no-rest-spread-properties: compose immutable state or forward the remaining typed props without mutating the caller object; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: React.ComponentProps<"div">). */

const CardAction = ({
  className,
  ...props
}: React.ComponentProps<"div">): React.JSX.Element => (
  <div
    className={cn(
      "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
      className
    )}
    data-slot="card-action"
    {...props}
  />
);
/* oxlint-enable oxc/no-rest-spread-properties, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable oxc/no-rest-spread-properties, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- CardContent: oxc/no-rest-spread-properties: compose immutable state or forward the remaining typed props without mutating the caller object; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: React.ComponentProps<"div">). */

const CardContent = ({
  className,
  ...props
}: React.ComponentProps<"div">): React.JSX.Element => (
  <div className={cn("px-6", className)} data-slot="card-content" {...props} />
);
/* oxlint-enable oxc/no-rest-spread-properties, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable oxc/no-rest-spread-properties, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- CardFooter: oxc/no-rest-spread-properties: compose immutable state or forward the remaining typed props without mutating the caller object; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: React.ComponentProps<"div">). */

const CardFooter = ({
  className,
  ...props
}: React.ComponentProps<"div">): React.JSX.Element => (
  <div
    className={cn("flex items-center px-6 [.border-t]:pt-6", className)}
    data-slot="card-footer"
    {...props}
  />
);
/* oxlint-enable oxc/no-rest-spread-properties, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/no-named-export -- card.tsx exports: import/no-named-export: existing callers import this public component, type, or hook by name. */

export {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
};
/* oxlint-enable import/no-named-export */
