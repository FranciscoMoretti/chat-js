"use client";
/* oxlint-disable sort-imports -- Oxfmt owns this module's external, type-only, and alias import groups; its case-insensitive order conflicts with this declaration-order rule. */

import React from "react";

import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
/* oxlint-enable sort-imports */
/* oxlint-disable import/no-named-export, import/prefer-default-export, react/jsx-no-literals, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types -- SettingsHeader: import/no-named-export: existing callers import this public component, type, or hook by name; import/prefer-default-export: the existing named import remains stable when this module adds another public declaration; react/jsx-no-literals: these existing labels and accessible text are this feature content; localization is a separate content migration; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships. */

export const SettingsHeader = () => {
  const { isMobile } = useSidebar();

  return (
    <div className="mb-8 flex flex-col items-start gap-2">
      <div className="h-10 shrink-0">{isMobile && <SidebarTrigger />}</div>
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Manage your chat preferences and configurations.
        </p>
      </div>
    </div>
  );
};
/* oxlint-enable import/no-named-export, import/prefer-default-export, react/jsx-no-literals, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types */
