"use client";

import React, { useSyncExternalStore } from "react";
import { InternalLink } from "@/components/internal-link";

import { SidebarMenuButton, useSidebar } from "@/components/ui/sidebar";

import { Plus } from "lucide-react";
import type { JSX as ReactJSX } from "react";

import { getNewChatShortcutText } from "@/components/keyboard-shortcuts";

export const NewChatButton = (): ReactJSX.Element => {
  const { setOpenMobile } = useSidebar();
  const shortcutText = useSyncExternalStore(
    () => (): void => {
      // This capability has no subscription to clean up.
    },
    getNewChatShortcutText,
    () => "Ctrl+Shift+O"
  );

  return (
    <SidebarMenuButton asChild className="mt-4" tooltip="New Chat">
      <InternalLink
        className="flex w-full items-center gap-2"
        href="/"
        onNavigate={() => {
          setOpenMobile(false);
          globalThis.dispatchEvent(new Event("chatjs:new-chat"));
        }}
      >
        <Plus aria-label="New Chat" size={16} />
        <span>New Chat</span>
        <span className="text-muted-foreground ml-auto text-xs">
          {shortcutText}
        </span>
      </InternalLink>
    </SidebarMenuButton>
  );
};
