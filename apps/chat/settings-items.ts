// Initial navigation order. Reorder or extend this array; chat-js sync preserves it.
import { Cpu, Settings } from "lucide-react";

import type { SettingsItem } from "@/components/settings/settings-item";
import { mcpSettingsItem } from "@/features/mcp/settings";

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (settingsItems); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export const settingsItems: SettingsItem[] = [
  { href: "/settings", icon: Settings, id: "general", label: "General" },
  { href: "/settings/models", icon: Cpu, id: "models", label: "Models" },
  mcpSettingsItem,
];
/* oxlint-enable import/prefer-default-export, import/no-named-export */
