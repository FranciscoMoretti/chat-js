"use client";

import { ArrowRight } from "lucide-react";
import React from "react";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { InternalLink } from "@/components/internal-link";
/* oxlint-enable sort-imports */
import { cn } from "@/lib/utils";

interface LoginPromptProps {
  className?: string;
  description: string;
  title: string;
}
/* oxlint-disable typescript/prefer-readonly-parameter-types -- LoginPrompt: ; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { title, description, className, }: LoginPromptProps). */

export const LoginPrompt = ({
  title,
  description,
  className,
}: LoginPromptProps): React.JSX.Element => (
  <div className={cn("space-y-3 p-4", className)}>
    <div className="flex items-center gap-2">
      <ArrowRight
        // oxlint-disable-next-line react/forbid-component-props -- ArrowRight accepts className in its styling contract; preserve this caller's layout and appearance.
        className="text-muted-foreground h-4 w-4"
      />
      <h4 className="text-sm font-medium">{title}</h4>
    </div>
    <p className="text-muted-foreground ml-6 text-sm">{description}</p>
    <InternalLink
      // oxlint-disable-next-line react/forbid-component-props -- InternalLink accepts className in its styling contract; preserve this caller's layout and appearance.
      className="ml-6 block text-sm font-medium text-blue-500 hover:underline"
      href="/login"
    >
      Sign in
    </InternalLink>
  </div>
);
/* oxlint-enable typescript/prefer-readonly-parameter-types */
