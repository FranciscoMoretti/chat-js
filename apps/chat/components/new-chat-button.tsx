"use client";

import { Plus } from "lucide-react";
import type { JSX as ReactJSX } from "react";
import React, { useSyncExternalStore } from "react";

import { InternalLink } from "@/components/internal-link";
import { getNewChatShortcutText } from "@/components/keyboard-shortcuts";
import { SidebarMenuButton, useSidebar } from "@/components/ui/sidebar";
/* oxlint-disable react-perf/jsx-no-new-function-as-prop -- NewChatButton: ; react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships. */

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
/* oxlint-enable react-perf/jsx-no-new-function-as-prop */
