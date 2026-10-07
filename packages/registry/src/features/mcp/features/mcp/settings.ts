import { Plug } from "lucide-react";

import type { SettingsItem } from "@/components/settings/settings-item";
import { installedFeatures } from "@/features/installed";

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (mcpSettingsItem); the enabled import/no-default-export convention rejects the default-export alternative. */
export const mcpSettingsItem: SettingsItem = {
  href: "/settings/connectors",
  icon: Plug,
  id: "mcp",
  isVisible: () => installedFeatures.has("mcp"),
  label: "Connectors",
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
