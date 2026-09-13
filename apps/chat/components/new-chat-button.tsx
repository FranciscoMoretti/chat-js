"use client";

import { Plus } from "lucide-react";
import { useEffect, useState } from "react";

import { InternalLink } from "@/components/internal-link";
import { getNewChatShortcutText } from "@/components/keyboard-shortcuts";
import { SidebarMenuButton, useSidebar } from "@/components/ui/sidebar";

export function NewChatButton() {
  const { setOpenMobile } = useSidebar();
  const [shortcutText, setShortcutText] = useState("Ctrl+Shift+O");

  useEffect(() => {
    setShortcutText(getNewChatShortcutText());
  }, []);

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
}
