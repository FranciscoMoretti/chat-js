"use client";

import { Smile } from "lucide-react";

import { ProjectIcon } from "@/components/project-icon";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { ProjectColorName, ProjectIconName } from "@/lib/project-icons";
import {
  DEFAULT_PROJECT_COLOR,
  PROJECT_COLORS,
  PROJECT_ICONS,
} from "@/lib/project-icons";
import { cn } from "@/lib/utils";

interface ProjectIconPickerProps {
  className?: string;
  color: ProjectColorName | null;
  icon: ProjectIconName | null;
  onColorChange: (color: ProjectColorName) => void;
  onIconChange: (icon: ProjectIconName) => void;
}

export const ProjectIconPicker = ({
  icon,
  color,
  onIconChange,
  onColorChange,
  className,
}: ProjectIconPickerProps) => {
  const displayColor = color ?? DEFAULT_PROJECT_COLOR;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          className={cn("size-9 p-0", className)}
          type="button"
          variant="outline"
        >
          {icon ? (
            <ProjectIcon color={displayColor} icon={icon} size={18} />
          ) : (
            <Smile className="text-muted-foreground size-[18px]" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-3">
        {/* Color row */}
        <div className="mb-3 flex gap-1.5">
          {PROJECT_COLORS.map((c) => (
            <button
              aria-label={`Select ${c.name} color`}
              aria-pressed={displayColor === c.name}
              className={cn(
                "size-6 rounded-full transition-transform hover:scale-110",
                displayColor === c.name &&
                  "ring-foreground ring-2 ring-offset-2"
              )}
              key={c.name}
              onClick={() => onColorChange(c.name)}
              style={{ backgroundColor: c.value }}
              type="button"
            />
          ))}
        </div>
        {/* Icon grid */}
        <div className="grid grid-cols-5 gap-1">
          {PROJECT_ICONS.map((iconName) => (
            <button
              aria-label={`Select ${iconName} icon`}
              aria-pressed={icon === iconName}
              className={cn(
                "hover:bg-muted flex size-8 items-center justify-center rounded-md transition-colors",
                icon === iconName && "bg-muted ring-foreground ring-1"
              )}
              key={iconName}
              onClick={() => onIconChange(iconName)}
              type="button"
            >
              <ProjectIcon color={displayColor} icon={iconName} size={18} />
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};
