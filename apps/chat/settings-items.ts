// Initial navigation order. Reorder or extend this array; chat-js sync preserves it.
import { Cpu, Settings } from "lucide-react";

import type { SettingsItem } from "@/components/settings/settings-item";
import { mcpSettingsItem } from "@/features/mcp/settings";

/* oxlint-disable import/no-named-export, import/prefer-default-export --
 * import/no-named-export (#527): Preserve the named settingsItems API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * import/prefer-default-export (#532): settingsItems remains a named API, consistent with no-default-export; adding future exports must not change caller import syntax.
 */
export const settingsItems: SettingsItem[] = [
  { href: "/settings", icon: Settings, id: "general", label: "General" },
  { href: "/settings/models", icon: Cpu, id: "models", label: "Models" },
  mcpSettingsItem,
];
/* oxlint-enable import/no-named-export, import/prefer-default-export */
