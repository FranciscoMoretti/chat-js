import type { LucideIcon } from "lucide-react";
import type { Route } from "next";

export interface SettingsItem {
  id: string;
  href: Route;
  label: string;
  icon: LucideIcon;
  isVisible?: () => boolean;
}
