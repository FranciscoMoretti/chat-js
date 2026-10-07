import React from "react";

import { cn } from "@/lib/utils";

const Skeleton = (
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Skeleton forwards the native div ref (including writable current), CSSProperties, children and TrustedHTML; React autoCapitalize/role also contain open string & {} aliases flagged even after top-level Readonly.
  {
    className,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    ...props
  }: React.ComponentProps<"div">
): React.JSX.Element => (
  <div
    className={cn("bg-muted animate-pulse rounded-md", className)}
    data-slot="skeleton"
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward Skeleton's native div attributes, preserving caller events and accessibility props.
    {...props}
  />
);
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (Skeleton); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */

export { Skeleton };
/* oxlint-enable import/prefer-default-export, import/no-named-export */
