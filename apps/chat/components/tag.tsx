"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export const Tag = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => (
  <span
    className={cn(
      "bg-muted text-muted-foreground flex gap-1 rounded px-1.5 py-1 text-xs",
      className
    )}
  >
    {children}
  </span>
);
