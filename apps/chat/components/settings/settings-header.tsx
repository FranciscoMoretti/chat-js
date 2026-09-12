"use client";

import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";

export function SettingsHeader() {
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
}
