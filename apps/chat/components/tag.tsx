"use client";

import React from "react";

import type { ReadonlyReactNode } from "@/lib/readonly-react-node";
import { cn } from "@/lib/utils";

export const Tag = ({
  children,
  className,
}: {
  readonly children: ReadonlyReactNode;
  readonly className?: string;
}): React.JSX.Element => (
  <span
    className={cn(
      "bg-muted text-muted-foreground flex gap-1 rounded px-1.5 py-1 text-xs",
      className
    )}
  >
    {children}
  </span>
);
