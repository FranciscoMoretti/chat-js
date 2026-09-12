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
import { getColorValue } from "@/lib/project-icons";
import { cn } from "@/lib/utils";

const ICON_MAP: Record<ProjectIconName, typeof Folder> = {
  folder: Folder,
  briefcase: Briefcase,
  book: Book,
  code: Code,
  "dollar-sign": DollarSign,
  "graduation-cap": GraduationCap,
  heart: Heart,
  home: Home,
  lightbulb: Lightbulb,
  music: Music,
  pencil: Pencil,
  plane: Plane,
  "shopping-cart": ShoppingCart,
  star: Star,
  target: Target,
  users: Users,
  zap: Zap,
  coffee: Coffee,
  camera: Camera,
  globe: Globe,
  flask: Beaker,
  "chart-bar": ChartBar,
  calendar: Calendar,
  clipboard: Clipboard,
  rocket: Rocket,
};

interface ProjectIconProps {
  className?: string;
  color: ProjectColorName;
  icon: ProjectIconName;
  size?: number;
}

export const ProjectIcon = ({
  icon,
  color,
  size = 16,
  className,
}: ProjectIconProps) => {
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
