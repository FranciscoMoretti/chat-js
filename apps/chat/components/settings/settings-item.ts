import type { LucideIcon } from "lucide-react";
/* oxlint-disable import/no-named-export -- SettingsItem: import/no-named-export: existing callers import this public component, type, or hook by name. */

export interface SettingsItem {
  id: string;
  href: string;
  label: string;
  icon: LucideIcon;
  isVisible?: () => boolean;
}
/* oxlint-enable import/no-named-export */
