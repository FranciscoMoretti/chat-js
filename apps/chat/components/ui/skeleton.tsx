import React from "react";

import { cn } from "@/lib/utils";

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

export { Skeleton };
