"use client";

import React from "react";

import { Skeleton } from "./ui/skeleton";

import { cn } from "@/lib/utils";

import { useMounted } from "@/hooks/use-mounted";

export const WithSkeleton = ({
  children,
  className,
  isLoading,
  ...props
}: React.ComponentProps<"div"> & {
  readonly isLoading?: boolean;
}): React.JSX.Element => {
  const mounted = useMounted();

  return (
    <div className={cn("relative w-fit", className)} {...props}>
      {children}
      {!mounted || isLoading === true ? (
        <>
          <div className={cn("bg-background absolute inset-0", className)} />

          <Skeleton className={cn("absolute inset-0", className)} />
        </>
      ) : (
        isLoading
      )}
    </div>
  );
};
