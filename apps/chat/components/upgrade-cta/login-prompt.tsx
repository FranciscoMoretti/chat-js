"use client";

import { ArrowRight } from "lucide-react";
import { InternalLink } from "@/components/internal-link";

import React from "react";

import { cn } from "@/lib/utils";

interface LoginPromptProps {
  readonly className?: string;
  readonly description: string;
  readonly title: string;
}
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (LoginPrompt); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable react/jsx-no-literals -- LoginPrompt renders authored interface labels, status copy and display punctuation; no translation-layer contract is defined here. */

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
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable react/jsx-no-literals */
