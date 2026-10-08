"use client";

import { useEffect } from "react";

import { useRouter } from "next/navigation";

import { useSidebar } from "@/components/ui/sidebar";
/* oxlint-disable unicorn/no-null -- KeyboardShortcuts: typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

const KeyboardShortcuts = (): null => {
  const router = useRouter();
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
        router.push("/");
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return (): void => document.removeEventListener("keydown", handleKeyDown);
  }, [setOpenMobile, router]);

  // This component only handles keyboard events
  return null;
};
/* oxlint-enable unicorn/no-null */

// Helper function to get platform-specific shortcut text
const getNewChatShortcutText = (): "Ctrl+Shift+O" | "Cmd+Shift+O" => {
  // oxlint-disable-next-line unicorn/prefer-global-this -- #572: This tests for a browser window; globalThis also exists during server rendering.
  if (typeof window === "undefined") {
    return "Ctrl+Shift+O";
  }

  const isMac = navigator.platform.toUpperCase().includes("MAC");
  if (isMac) {
    return "Cmd+Shift+O";
  }
  return "Ctrl+Shift+O";
};
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (getNewChatShortcutText, KeyboardShortcuts); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */

/* oxlint-disable react/only-export-components -- #620: Consumers import getNewChatShortcutText, KeyboardShortcuts from this existing mixed component, context, or helper API; separating the Fast Refresh boundary remains tracked review debt. */
export { getNewChatShortcutText, KeyboardShortcuts };
/* oxlint-enable import/no-named-export */
/* oxlint-enable react/only-export-components */
