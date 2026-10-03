"use client";
/* oxlint-disable sort-imports -- Oxfmt owns this module's external, type-only, and alias import groups; its case-insensitive order conflicts with this declaration-order rule. */

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
/* oxlint-enable sort-imports */

interface ProjectIconPickerProps {
  className?: string;
  color: ProjectColorName | null;
  icon: ProjectIconName | null;
  onColorChange: (color: ProjectColorName) => void;
  onIconChange: (icon: ProjectIconName) => void;
}
/* oxlint-disable id-length, import/no-named-export, import/prefer-default-export, max-lines-per-function, no-ternary, react-perf/jsx-no-new-function-as-prop, react-perf/jsx-no-new-object-as-prop, react/forbid-component-props, react/jsx-max-depth, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types -- ProjectIconPicker: id-length: retain conventional event, index, and generic identifiers in this existing callback contract; import/no-named-export: existing callers import this public component, type, or hook by name; import/prefer-default-export: the existing named import remains stable when this module adds another public declaration; max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; no-ternary: derive the existing render or state alternative inline without introducing another mutable state variable; react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; react-perf/jsx-no-new-object-as-prop: this prop object derives from current render state or feature styling; hoisting changes its ownership; react/forbid-component-props: className and style are the existing Tailwind and primitive composition API; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

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
          {PROJECT_COLORS.map((c): React.JSX.Element => (
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
/* oxlint-enable id-length, import/no-named-export, import/prefer-default-export, max-lines-per-function, no-ternary, react-perf/jsx-no-new-function-as-prop, react-perf/jsx-no-new-object-as-prop, react/forbid-component-props, react/jsx-max-depth, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types */
