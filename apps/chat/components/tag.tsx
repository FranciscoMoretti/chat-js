"use client";

import React from "react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
/* oxlint-disable typescript/prefer-readonly-parameter-types -- Tag: ; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

export const Tag = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
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
/* oxlint-enable typescript/prefer-readonly-parameter-types */
