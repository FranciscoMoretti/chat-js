"use client";
/* oxlint-disable sort-imports -- Oxfmt owns this module's external, type-only, and alias import groups; its case-insensitive order conflicts with this declaration-order rule. */

import React from "react";
import type { ReactNode } from "react";

import { HeaderActions } from "@/components/header-actions";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
/* oxlint-enable sort-imports */
/* oxlint-disable import/no-named-export, import/prefer-default-export, react/forbid-component-props, react/jsx-max-depth, typescript/prefer-readonly-parameter-types -- ChatHeaderView: import/no-named-export: existing callers import this public component, type, or hook by name; import/prefer-default-export: the existing named import remains stable when this module adds another public declaration; react/forbid-component-props: className and style are the existing Tailwind and primitive composition API; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

export const ChatHeaderView = ({
  breadcrumb,
  actions,
  className,
}: {
  breadcrumb: ReactNode;
  actions?: ReactNode;
  className?: string;
}): React.JSX.Element => (
  <header
    className={cn(
      "bg-background sticky top-0 flex items-center justify-between gap-2 px-2 py-1.5 md:px-2",
      className
    )}
  >
    <div className="flex flex-1 items-center justify-between gap-2 overflow-hidden">
      <div className="flex min-w-0 items-center gap-2">
        <SidebarTrigger className="md:hidden" />
        {breadcrumb}
      </div>
      {actions}
    </div>
    <HeaderActions />
  </header>
);
/* oxlint-enable import/no-named-export, import/prefer-default-export, react/forbid-component-props, react/jsx-max-depth, typescript/prefer-readonly-parameter-types */
