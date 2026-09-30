import type { LucideIcon } from "lucide-react";

export type SettingsItem = {
  id: string;
  href: string;
  label: string;
  icon: LucideIcon;
  isVisible?: () => boolean;
};
