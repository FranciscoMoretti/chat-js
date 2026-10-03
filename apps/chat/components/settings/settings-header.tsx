"use client";

import React from "react";

import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
/* oxlint-disable typescript/explicit-function-return-type, typescript/explicit-module-boundary-types -- SettingsHeader: ; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships. */

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
/* oxlint-enable typescript/explicit-function-return-type, typescript/explicit-module-boundary-types */
