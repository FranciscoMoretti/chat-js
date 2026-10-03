"use client";

import React from "react";

import { useMounted } from "@/hooks/use-mounted";
import { cn } from "@/lib/utils";

import { Skeleton } from "./ui/skeleton";
/* oxlint-disable react/forbid-component-props, react/jsx-props-no-spreading, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions -- WithSkeleton: ; react/forbid-component-props: className and style are the existing Tailwind and primitive composition API; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types; typescript/strict-boolean-expressions: the existing empty, missing, or optional value deliberately selects this feature fallback (including isLoading). */

export const WithSkeleton = ({
  children,
  className,
  isLoading,
  ...props
}: React.ComponentProps<"div"> & {
  isLoading?: boolean;
}) => {
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
/* oxlint-enable react/forbid-component-props, react/jsx-props-no-spreading, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */
