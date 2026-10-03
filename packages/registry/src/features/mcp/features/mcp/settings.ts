import { Plug } from "lucide-react";

import type { SettingsItem } from "@/components/settings/settings-item";
import { installedFeatures } from "@/features/installed";

/* oxlint-disable import/prefer-default-export -- Keep the named import contract used by registry consumers and package callers even when this module exposes one value. */
/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
export const mcpSettingsItem: SettingsItem = {
  href: "/settings/connectors",
  icon: Plug,
  id: "mcp",
  isVisible: () => installedFeatures.has("mcp"),
  label: "Connectors",
};
/* oxlint-enable import/no-named-export */
/* oxlint-enable import/prefer-default-export */
