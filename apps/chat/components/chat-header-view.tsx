"use client";

import React from "react";
import type { ReactNode } from "react";

import { HeaderActions } from "@/components/header-actions";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
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
        <SidebarTrigger className="md:hidden" />
        {breadcrumb}
      </div>
      {actions}
    </div>
    <HeaderActions />
  </header>
);
/* oxlint-enable react/jsx-max-depth, typescript/prefer-readonly-parameter-types */
