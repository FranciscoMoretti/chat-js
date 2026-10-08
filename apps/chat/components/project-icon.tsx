import {
  Beaker,
  Book,
  Briefcase,
  Calendar,
  Camera,
  ChartBar,
  Clipboard,
  Code,
  Coffee,
  DollarSign,
  Folder,
  Globe,
  GraduationCap,
  Heart,
  Home,
  Lightbulb,
  Music,
  Pencil,
  Plane,
  Rocket,
  ShoppingCart,
  Star,
  Target,
  Users,
  Zap,
} from "lucide-react";
import type { ProjectColorName, ProjectIconName } from "@/lib/project-icons";

import React from "react";

import { getColorValue } from "@/lib/project-icons";

/* oxlint-disable sort-imports -- The combined development and production module-effect trace rejects swapping @/lib/project-icons and @/lib/utils; keep this adjacent import pair ordered. */
import { cn } from "@/lib/utils";
/* oxlint-enable sort-imports */

const DEFAULT_ICON_SIZE = 16;

const ICON_MAP: Record<ProjectIconName, typeof Folder> = {
  book: Book,
  briefcase: Briefcase,
  calendar: Calendar,
  camera: Camera,
  "chart-bar": ChartBar,
  clipboard: Clipboard,
  code: Code,
  coffee: Coffee,
  "dollar-sign": DollarSign,
  flask: Beaker,
  folder: Folder,
  globe: Globe,
  "graduation-cap": GraduationCap,
  heart: Heart,
  home: Home,
  lightbulb: Lightbulb,
  music: Music,
  pencil: Pencil,
  plane: Plane,
  rocket: Rocket,
  "shopping-cart": ShoppingCart,
  star: Star,
  target: Target,
  users: Users,
  zap: Zap,
};

interface ProjectIconProps {
  readonly className?: string;
  readonly color: ProjectColorName;
  readonly icon: ProjectIconName;
  readonly size?: number;
}
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (ProjectIcon); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable react-perf/jsx-no-new-object-as-prop -- react-perf/jsx-no-new-object-as-prop: this prop object derives from current render state or feature styling; hoisting changes its ownership */

export const ProjectIcon = ({
  icon,
  color,
  size = DEFAULT_ICON_SIZE,
  className,
}: ProjectIconProps): React.JSX.Element => {
  const IconComponent = ICON_MAP[icon] ?? Folder;
  const colorValue = getColorValue(color);

  return (
    <IconComponent
      // oxlint-disable-next-line react/forbid-component-props -- IconComponent accepts className in its styling contract; preserve this caller's layout and appearance.
      className={cn("shrink-0", className)}
      size={size}
      // oxlint-disable-next-line react/forbid-component-props -- IconComponent accepts style in its styling contract; preserve this caller's layout and appearance.
      style={{ color: colorValue }}
    />
  );
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable react-perf/jsx-no-new-object-as-prop */
