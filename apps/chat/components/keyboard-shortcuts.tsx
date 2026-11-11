"use client";

import { useChatNavigation } from "./chat/chat-navigation";
import { useEffect } from "react";

import { useRouter } from "next/navigation";

import { useSidebar } from "@/components/ui/sidebar";

const KeyboardShortcuts = (): null => {
  const router = useRouter();
  const embedded = useChatNavigation();
  const { setOpenMobile } = useSidebar();

  // Keyboard shortcut for new chat
  useEffect(() => {
    const handleKeyDown = (
      event: Readonly<
        Pick<
          KeyboardEvent,
          "shiftKey" | "key" | "metaKey" | "ctrlKey" | "preventDefault"
        >
      >
    ): void => {
      if (
        event.shiftKey &&
        event.key === "O" &&
        (event.metaKey || event.ctrlKey)
      ) {
        event.preventDefault();
        setOpenMobile(false);
        globalThis.dispatchEvent(new Event("chatjs:new-chat"));
        if (embedded) {
          embedded.navigate("/");
        } else {
          router.push("/");
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return (): void => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [setOpenMobile, router, embedded]);

  // This component only handles keyboard events
  return null;
};

// Helper function to get platform-specific shortcut text
const getNewChatShortcutText = (): "Ctrl+Shift+O" | "Cmd+Shift+O" => {
  if (typeof window === "undefined") {
    return "Ctrl+Shift+O";
  }

  const isMac = navigator.platform.toUpperCase().includes("MAC");
  if (isMac) {
    return "Cmd+Shift+O";
  }
  return "Ctrl+Shift+O";
};

export { getNewChatShortcutText, KeyboardShortcuts };
