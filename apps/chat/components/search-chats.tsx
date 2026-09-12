"use client";

import { SearchIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { useSidebar } from "@/components/ui/sidebar";

import { SearchChatsDialog } from "./search-chats-dialog";
import { SidebarMenuButton } from "./ui/sidebar";

// Helper function to get platform-specific shortcut text
const getSearchShortcutText = () => {
  if (typeof window === "undefined") {
    return "Ctrl+K";
  }

  const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
  return isMac ? "Cmd+K" : "Ctrl+K";
};

export const SearchChatsButton = () => {
  const [open, setOpen] = useState(false);
  const { setOpenMobile } = useSidebar();
  const [shortcutText, setShortcutText] = useState("Ctrl+K");

  // Update shortcut text on mount
  useEffect(() => {
    setShortcutText(getSearchShortcutText());
  }, []);

  // Global keyboard shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((isOpen) => !isOpen);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  return (
    <>
      <SidebarMenuButton
        className="w-full justify-start"
        onClick={() => setOpen(true)}
        tooltip="Search chats"
      >
        <SearchIcon className="h-4 w-4" />
        <span>Search chats</span>
        <span className="text-muted-foreground ml-auto text-xs">
          {shortcutText}
        </span>
      </SidebarMenuButton>

      {open && (
        <SearchChatsDialog
          onOpenChange={setOpen}
          onSelectChat={() => setOpenMobile(false)}
          open={open}
        />
      )}
    </>
  );
};
