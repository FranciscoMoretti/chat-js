"use client";

import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";

import React from "react";
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (SettingsHeader); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable react/jsx-no-literals -- SettingsHeader renders authored interface labels, status copy and display punctuation; no translation-layer contract is defined here. */

export const SettingsHeader = (): React.JSX.Element => {
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
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable react/jsx-no-literals */
