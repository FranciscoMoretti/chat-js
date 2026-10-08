"use client";

import React, { useSyncExternalStore } from "react";
import { InternalLink } from "@/components/internal-link";

/* oxlint-disable sort-imports -- The combined development and production module-effect trace rejects swapping @/components/internal-link and @/components/ui/sidebar; keep this adjacent import pair ordered. */
import { SidebarMenuButton, useSidebar } from "@/components/ui/sidebar";
/* oxlint-enable sort-imports */

import { Plus } from "lucide-react";
import type { JSX as ReactJSX } from "react";

import { getNewChatShortcutText } from "@/components/keyboard-shortcuts";
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (NewChatButton); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable react/jsx-no-literals -- NewChatButton renders authored interface labels, status copy and display punctuation; no translation-layer contract is defined here. */

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
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable react/jsx-no-literals */
/* oxlint-enable react-perf/jsx-no-new-function-as-prop */
