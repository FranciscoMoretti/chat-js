// Initial navigation order. Reorder or extend this array; chat-js sync preserves it.
import { Cpu, Settings } from "lucide-react";

import type { SettingsItem } from "@/components/settings/settings-item";
import { mcpClient } from "@/plugins/mcp/client-plugin";

export const settingsItems: SettingsItem[] = [
  { href: "/settings", icon: Settings, id: "general", label: "General" },
  { href: "/settings/models", icon: Cpu, id: "models", label: "Models" },
  ...mcpClient().settingsItems,
];
