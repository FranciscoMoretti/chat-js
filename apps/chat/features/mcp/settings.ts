import { Plug } from "lucide-react";

import type { SettingsItem } from "@/components/settings/settings-item";
import { config } from "@/lib/config";

export const mcpSettingsItem: SettingsItem = {
  href: "/settings/connectors",
  icon: Plug,
  id: "mcp",
  isVisible: () => config.ai.tools.mcp.enabled,
  label: "Connectors",
};
