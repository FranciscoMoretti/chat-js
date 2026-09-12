"use client";

import { Plus } from "lucide-react";
import { useSyncExternalStore } from "react";

import { InternalLink } from "@/components/internal-link";
import { getNewChatShortcutText } from "@/components/keyboard-shortcuts";
import { SidebarMenuButton, useSidebar } from "@/components/ui/sidebar";

export const NewChatButton = () => {
  const { setOpenMobile } = useSidebar();
  const shortcutText = useSyncExternalStore(
    () => () => null,
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
