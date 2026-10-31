"use client";
import { Settings } from "lucide-react";
import { ModelSettingsLink, SettingsLinks } from "@/components/chat-slots";
import { SettingsLink } from "@/components/settings/settings-navigation-link";
import { cn } from "@/lib/utils";

export const SettingsNav = ({
  orientation = "vertical",
}: {
  readonly orientation?: "horizontal" | "vertical";
}) => (
  <nav
    className={cn(
      "flex gap-1 sm:overflow-auto sm:pb-2",
      orientation === "vertical" ? "w-56 flex-col" : "flex-row"
    )}
  >
    <SettingsLink href="/settings">
      <Settings className="size-4" />
      General
    </SettingsLink>
    <ModelSettingsLink surface="settings" />
    <SettingsLinks />
  </nav>
);
