// Initial navigation order. Reorder or extend this array; chat-js sync preserves it.
import { Cpu, Settings } from "lucide-react";

import type { SettingsItem } from "@/components/settings/settings-item";
import { mcpSettingsItem } from "@/features/mcp/settings";

export const settingsItems: SettingsItem[] = [
  { href: "/settings", icon: Settings, id: "general", label: "General" },
  { href: "/settings/models", icon: Cpu, id: "models", label: "Models" },
  mcpSettingsItem,
];
