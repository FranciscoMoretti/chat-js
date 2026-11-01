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
  <DropdownMenuTrigger asChild>
    <SidebarMenuAction
      className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground mr-0.5"
      showOnHover={showOnHover}
    >
      {children}
    </SidebarMenuAction>
  </DropdownMenuTrigger>
);

export const AccountMenuTrigger = ({
  children,
  collapsed,
}: {
  readonly children: ReactNode;
  readonly collapsed: boolean;
}) => (
  <DropdownMenuTrigger asChild>
    <SidebarMenuButton
      className={cn(
        "data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground mx-auto",
        collapsed && "flex flex-col items-center justify-center"
      )}
      size="lg"
    >
      {children}
    </SidebarMenuButton>
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
    className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-56 rounded-lg"
    side={side}
    sideOffset={4}
  >
    {children}
  </DropdownMenuContent>
);
