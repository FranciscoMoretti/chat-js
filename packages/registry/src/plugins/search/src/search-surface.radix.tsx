"use client";
import React from "react";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { SidebarMenuButton } from "@/components/ui/sidebar";
import type { SearchSurfaceProps } from "./search-surface-props";

export const SearchSurface = ({
  open,
  onOpenChange,
  trigger,
  children,
}: SearchSurfaceProps): React.JSX.Element => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogTrigger asChild>
      <SidebarMenuButton tooltip="Search chats">{trigger}</SidebarMenuButton>
    </DialogTrigger>
    {children}
  </Dialog>
);
