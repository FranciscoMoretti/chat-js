import type { LucideIcon } from "lucide-react";

/* oxlint-disable import/no-named-export -- Keep the named type bindings (SettingsItem); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export interface SettingsItem {
  id: string;
  href: string;
  label: string;
  icon: LucideIcon;
  isVisible?: () => boolean;
}
/* oxlint-enable import/no-named-export */
