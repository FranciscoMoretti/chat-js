"use client";
import type { ReactNode } from "react";
import { SidebarMenuAction, SidebarMenuButton } from "@/components/ui/sidebar";
import {
  DropdownMenuTrigger,
  DropdownMenuContent,
} from "@/components/ui/dropdown-menu";
import { cn } from "../lib/utils";

export const SidebarActionMenu = ({
  children,
  showOnHover,
}: {
  readonly children: ReactNode;
  readonly showOnHover?: boolean;
}) => (
  <DropdownMenuTrigger
    render={
      <SidebarMenuAction
        className="data-open:bg-sidebar-accent data-open:text-sidebar-accent-foreground mr-0.5"
        showOnHover={showOnHover}
      />
    }
  >
    {children}
  </DropdownMenuTrigger>
);

export const AccountMenuTrigger = ({
  children,
  collapsed,
}: {
  readonly children: ReactNode;
  readonly collapsed: boolean;
}) => (
  <DropdownMenuTrigger
    render={
      <SidebarMenuButton
        className={cn(
          "data-open:bg-sidebar-accent data-open:text-sidebar-accent-foreground mx-auto",
          collapsed && "flex flex-col items-center justify-center"
        )}
        size="lg"
      />
    }
  >
    {children}
  </DropdownMenuTrigger>
);

export const AccountMenuContent = ({
  children,
  side,
}: {
  readonly children: ReactNode;
  readonly side: "bottom" | "right";
}) => (
  <DropdownMenuContent
    align="end"
    className="w-[var(--anchor-width)] min-w-56 rounded-lg"
    side={side}
    sideOffset={4}
  >
    {children}
  </DropdownMenuContent>
);
