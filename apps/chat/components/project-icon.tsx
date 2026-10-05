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
import React from "react";

import type { ProjectColorName, ProjectIconName } from "@/lib/project-icons";
import { getColorValue } from "@/lib/project-icons";
import { cn } from "@/lib/utils";

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
/* oxlint-disable no-magic-numbers, react-perf/jsx-no-new-object-as-prop -- no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 16); react-perf/jsx-no-new-object-as-prop: this prop object derives from current render state or feature styling; hoisting changes its ownership; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { icon, color, size = 16, className, }: ProjectIconProps). */

export const ProjectIcon = ({
  icon,
  color,
  size = 16,
  className,
}: ProjectIconProps): React.JSX.Element => {
  const IconComponent = ICON_MAP[icon] ?? Folder;
  const colorValue = getColorValue(color);

  return (
    <IconComponent
      className={cn("shrink-0", className)}
      size={size}
      style={{ color: colorValue }}
    />
  );
};
/* oxlint-enable no-magic-numbers, react-perf/jsx-no-new-object-as-prop */
