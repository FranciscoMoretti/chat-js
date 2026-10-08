"use client";

import React from "react";

import { useMounted } from "@/hooks/use-mounted";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { cn } from "@/lib/utils";
/* oxlint-enable sort-imports */

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { Skeleton } from "./ui/skeleton";
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (WithSkeleton); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable sort-imports */
/* oxlint-disable react/jsx-props-no-spreading, typescript/strict-boolean-expressions -- react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; typescript/strict-boolean-expressions: the existing empty, missing, or optional value deliberately selects this feature fallback (including isLoading). */

export const WithSkeleton = (
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- Forwards the original native element or primitive props, including ref/event callbacks and component constructors; their exact callable and DOM contracts remain flagged by the faithful readonly rule control. */
  {
    children,
    className,
    isLoading,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes children, className, isLoading from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    ...props
  }: React.ComponentProps<"div"> & {
    readonly isLoading?: boolean;
  }
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
): React.JSX.Element => {
  const mounted = useMounted();

  return (
    <div className={cn("relative w-fit", className)} {...props}>
      {children}

      {(!mounted || isLoading) && (
        <>
          <div className={cn("bg-background absolute inset-0", className)} />

          <Skeleton
            // oxlint-disable-next-line react/forbid-component-props -- Skeleton accepts className in its styling contract; preserve this caller's layout and appearance.
            className={cn("absolute inset-0", className)}
          />
        </>
      )}
    </div>
  );
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable react/jsx-props-no-spreading, typescript/strict-boolean-expressions */
