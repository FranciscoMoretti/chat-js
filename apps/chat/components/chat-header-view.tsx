"use client";

import React from "react";
import type { ReactNode } from "react";

/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import { HeaderActions } from "@/components/header-actions";
/* oxlint-enable sort-imports */
import { SidebarTrigger } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (ChatHeaderView); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable react/jsx-max-depth, typescript/prefer-readonly-parameter-types -- ChatHeaderView: ; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

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
        <SidebarTrigger
          // oxlint-disable-next-line react/forbid-component-props -- SidebarTrigger accepts className in its styling contract; preserve this caller's layout and appearance.
          className="md:hidden"
        />
        {breadcrumb}
      </div>
      {actions}
    </div>
    <HeaderActions />
  </header>
);
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable react/jsx-max-depth, typescript/prefer-readonly-parameter-types */
