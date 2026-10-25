// Initial navigation order. Reorder or extend this array; chat-js sync preserves it.
import { Settings } from "lucide-react";

import type { SettingsItem } from "@/components/settings/settings-item";
import { modelPreferencesClient } from "@/plugins/model-preferences/client-plugin";
import { mcpClient } from "@/plugins/mcp/client-plugin";

export const settingsItems: SettingsItem[] = [
  { href: "/settings", icon: Settings, id: "general", label: "General" },
  ...modelPreferencesClient().settingsItems,
  ...mcpClient().settingsItems,
];
