"use client";

import React from "react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
/* oxlint-disable import/no-named-export, import/prefer-default-export, typescript/prefer-readonly-parameter-types -- Tag: import/no-named-export: existing callers import this public component, type, or hook by name; import/prefer-default-export: the existing named import remains stable when this module adds another public declaration; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

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
/* oxlint-enable import/no-named-export, import/prefer-default-export, typescript/prefer-readonly-parameter-types */
