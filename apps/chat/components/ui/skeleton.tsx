import React from "react";

import { cn } from "@/lib/utils";
/* oxlint-disable oxc/no-rest-spread-properties, react/jsx-props-no-spreading, typescript/prefer-readonly-parameter-types -- Skeleton: oxc/no-rest-spread-properties: compose immutable state or forward the remaining typed props without mutating the caller object; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: React.ComponentProps<"div">). */

const Skeleton = ({
  className,
  ...props
}: React.ComponentProps<"div">): React.JSX.Element => (
  <div
    className={cn("bg-muted animate-pulse rounded-md", className)}
    data-slot="skeleton"
    {...props}
  />
);
/* oxlint-enable oxc/no-rest-spread-properties, react/jsx-props-no-spreading, typescript/prefer-readonly-parameter-types */
/* oxlint-disable import/no-named-export, import/prefer-default-export -- skeleton.tsx exports: import/no-named-export: existing callers import this public component, type, or hook by name; import/prefer-default-export: the existing named import remains stable when this module adds another public declaration. */

export { Skeleton };
/* oxlint-enable import/no-named-export, import/prefer-default-export */
