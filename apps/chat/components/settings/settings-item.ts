import type { LucideIcon } from "lucide-react";

export interface SettingsItem {
  id: string;
  href: string;
  label: string;
  icon: LucideIcon;
  isVisible?: () => boolean;
}
