"use client";
import React from "react";
import { createPortal } from "react-dom";
import { Dialog, DialogOverlay, DialogTrigger } from "@/components/ui/dialog";
import { SidebarMenuButton, useSidebar } from "@/components/ui/sidebar";
import type { SearchSurfaceProps } from "./search-surface-props";

export const SearchSurface = ({
  open,
  onOpenChange,
  trigger,
  children,
}: SearchSurfaceProps): React.JSX.Element => {
  const { isMobile, openMobile } = useSidebar();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={<SidebarMenuButton tooltip="Search chats" />}>
        {trigger}
      </DialogTrigger>
      {/* Base omits nested backdrops; cover the parent mobile sheet as well. */}
      {open &&
        isMobile &&
        openMobile &&
        createPortal(<DialogOverlay forceRender />, document.body)}
      {children}
    </Dialog>
  );
};
