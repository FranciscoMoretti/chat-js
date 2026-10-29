import { Settings } from "lucide-react";
import type { SettingsItem } from "@/components/settings/settings-item";
import { settingsItems as installedItems } from "@/composition/generated/installed-settings-items";
import { composeContributions } from "@/lib/compose-contributions";

export const settingsItems: SettingsItem[] = composeContributions<SettingsItem>(
  installedItems,
  [{ href: "/settings", icon: Settings, id: "general", label: "General" }],
  { order: ["general", "models", "mcp"] }
);
