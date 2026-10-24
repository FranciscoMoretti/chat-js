import { Plug } from "lucide-react";

import type { SettingsItem } from "@/components/settings/settings-item";
import { installedPlugins } from "@/composition/generated/installed";

export const mcpSettingsItem: SettingsItem = {
  href: "/settings/connectors",
  icon: Plug,
  id: "mcp",
  isVisible: () => installedPlugins.has("mcp"),
  label: "Connectors",
};
