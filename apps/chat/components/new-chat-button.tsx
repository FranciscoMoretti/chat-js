"use client";

import { Plus } from "lucide-react";
import React, { useSyncExternalStore } from "react";

import { InternalLink } from "@/components/internal-link";
import { getNewChatShortcutText } from "@/components/keyboard-shortcuts";
import { SidebarMenuButton, useSidebar } from "@/components/ui/sidebar";
/* oxlint-disable react-perf/jsx-no-new-function-as-prop, react/forbid-component-props, react/jsx-no-literals, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types -- NewChatButton: ; react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; react/forbid-component-props: className and style are the existing Tailwind and primitive composition API; react/jsx-no-literals: these existing labels and accessible text are this feature content; localization is a separate content migration; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships. */

export const NewChatButton = () => {
  const { setOpenMobile } = useSidebar();
  const shortcutText = useSyncExternalStore(
    () => () => {
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
/* oxlint-enable react-perf/jsx-no-new-function-as-prop, react/forbid-component-props, react/jsx-no-literals, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types */
