"use client";
import { useMounted } from "@/hooks/use-mounted";
import { cn } from "@/lib/utils";

import { Skeleton } from "./ui/skeleton";

export function WithSkeleton({
  children,
  className,
  isLoading,
  ...props
}: React.ComponentProps<"div"> & {
  isLoading?: boolean;
}) {
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
}
