"use client";

import { Plus } from "lucide-react";
import type { JSX as ReactJSX } from "react";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import React, { useSyncExternalStore } from "react";
/* oxlint-enable sort-imports */

import { InternalLink } from "@/components/internal-link";
import { getNewChatShortcutText } from "@/components/keyboard-shortcuts";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { SidebarMenuButton, useSidebar } from "@/components/ui/sidebar";
/* oxlint-disable react/jsx-no-literals -- NewChatButton renders authored interface labels, status copy and display punctuation; no translation-layer contract is defined here. */
/* oxlint-enable sort-imports */
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
    <SidebarMenuButton
      asChild
      // oxlint-disable-next-line react/forbid-component-props -- SidebarMenuButton accepts className in its styling contract; preserve this caller's layout and appearance.
      className="mt-4"
      tooltip="New Chat"
    >
      <InternalLink
        // oxlint-disable-next-line react/forbid-component-props -- InternalLink accepts className in its styling contract; preserve this caller's layout and appearance.
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
/* oxlint-enable react/jsx-no-literals */
/* oxlint-enable react-perf/jsx-no-new-function-as-prop */
