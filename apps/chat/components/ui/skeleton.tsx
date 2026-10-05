import React from "react";

import { cn } from "@/lib/utils";
/* oxlint-disable typescript/prefer-readonly-parameter-types -- Skeleton: typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: React.ComponentProps<"div">). */

const Skeleton = ({
  className,
  // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
  ...props
}: React.ComponentProps<"div">): React.JSX.Element => (
  <div
    className={cn("bg-muted animate-pulse rounded-md", className)}
    data-slot="skeleton"
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward Skeleton's native div attributes, preserving caller events and accessibility props.
    {...props}
  />
);
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (Skeleton); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable typescript/prefer-readonly-parameter-types */

export { Skeleton };
/* oxlint-enable import/prefer-default-export, import/no-named-export */
