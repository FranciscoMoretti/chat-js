import React from "react";

import { cn } from "@/lib/utils";
/* oxlint-disable typescript/prefer-readonly-parameter-types -- Skeleton: typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: React.ComponentProps<"div">). */

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
/* oxlint-enable typescript/prefer-readonly-parameter-types */

export { Skeleton };
