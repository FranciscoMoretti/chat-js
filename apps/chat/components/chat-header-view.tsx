"use client";

import type { ReactNode } from "react";

import { HeaderActions } from "@/components/header-actions";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

export const ChatHeaderView = ({
  breadcrumb,
  actions,
  className,
}: {
  breadcrumb: ReactNode;
  actions?: ReactNode;
  className?: string;
}) => (
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
