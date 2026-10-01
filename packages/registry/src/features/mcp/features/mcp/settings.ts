import { Plug } from "lucide-react";

import type { SettingsItem } from "@/components/settings/settings-item";
import { installedFeatures } from "@/features/installed";

export const mcpSettingsItem: SettingsItem = {
  href: "/settings/connectors",
  icon: Plug,
  id: "mcp",
  isVisible: () => installedFeatures.has("mcp"),
  label: "Connectors",
};
