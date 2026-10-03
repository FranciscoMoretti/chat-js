"use client";

import { Smile } from "lucide-react";
import React from "react";

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
/* oxlint-disable max-lines-per-function, react/jsx-max-depth, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types -- ProjectIconPicker: max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

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
          {PROJECT_COLORS.map((swatchColor): React.JSX.Element => (
            <button
              aria-label={`Select ${swatchColor.name} color`}
              aria-pressed={displayColor === swatchColor.name}
              className={cn(
                "size-6 rounded-full transition-transform hover:scale-110",
                displayColor === swatchColor.name &&
                  "ring-foreground ring-2 ring-offset-2"
              )}
              key={swatchColor.name}
              onClick={() => onColorChange(swatchColor.name)}
              style={{ backgroundColor: swatchColor.value }}
              type="button"
            />
          ))}
        </div>
        {/* Icon grid */}
        <div className="grid grid-cols-5 gap-1">
          {PROJECT_ICONS.map((iconName): React.JSX.Element => (
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
/* oxlint-enable max-lines-per-function, react/jsx-max-depth, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types */
