"use client";
/* oxlint-disable sort-imports -- Oxfmt owns this module's external, type-only, and alias import groups; its case-insensitive order conflicts with this declaration-order rule. */

import { ArrowRight } from "lucide-react";
import React from "react";

import { InternalLink } from "@/components/internal-link";
import { cn } from "@/lib/utils";
/* oxlint-enable sort-imports */

interface LoginPromptProps {
  className?: string;
  description: string;
  title: string;
}
/* oxlint-disable import/no-named-export, import/prefer-default-export, react/forbid-component-props, react/jsx-no-literals, typescript/prefer-readonly-parameter-types -- LoginPrompt: import/no-named-export: existing callers import this public component, type, or hook by name; import/prefer-default-export: the existing named import remains stable when this module adds another public declaration; react/forbid-component-props: className and style are the existing Tailwind and primitive composition API; react/jsx-no-literals: these existing labels and accessible text are this feature content; localization is a separate content migration; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { title, description, className, }: LoginPromptProps). */

export const LoginPrompt = ({
  title,
  description,
  className,
}: LoginPromptProps): React.JSX.Element => (
  <div className={cn("space-y-3 p-4", className)}>
    <div className="flex items-center gap-2">
      <ArrowRight className="text-muted-foreground h-4 w-4" />
      <h4 className="text-sm font-medium">{title}</h4>
    </div>
    <p className="text-muted-foreground ml-6 text-sm">{description}</p>
    <InternalLink
      className="ml-6 block text-sm font-medium text-blue-500 hover:underline"
      href="/login"
    >
      Sign in
    </InternalLink>
  </div>
);
/* oxlint-enable import/no-named-export, import/prefer-default-export, react/forbid-component-props, react/jsx-no-literals, typescript/prefer-readonly-parameter-types */
