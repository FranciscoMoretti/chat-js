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
import type {
  ProjectColorName,
  ProjectIconName,
} from "@/plugins/projects/project-icons";

import React from "react";

import { getColorValue } from "@/plugins/projects/project-icons";

import { cn } from "@/lib/utils";

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
      className={cn("shrink-0", className)}
      size={size}
      style={{ color: colorValue }}
    />
  );
};
