"use client";

import React from "react";

import { useMounted } from "@/hooks/use-mounted";
import { cn } from "@/lib/utils";

import { Skeleton } from "./ui/skeleton";
/* oxlint-disable react/jsx-props-no-spreading, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions -- react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types; typescript/strict-boolean-expressions: the existing empty, missing, or optional value deliberately selects this feature fallback (including isLoading). */

export const WithSkeleton = ({
  children,
  className,
  isLoading,
  ...props
}: React.ComponentProps<"div"> & {
  isLoading?: boolean;
}): React.JSX.Element => {
  const mounted = useMounted();

  return (
    <div className={cn("relative w-fit", className)} {...props}>
      {children}

      {(!mounted || isLoading) && (
        <>
          <div className={cn("bg-background absolute inset-0", className)} />

          <Skeleton className={cn("absolute inset-0", className)} />
        </>
      )}
    </div>
  );
};
/* oxlint-enable react/jsx-props-no-spreading, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */
