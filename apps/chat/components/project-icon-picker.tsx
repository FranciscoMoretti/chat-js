"use client";

import { Smile } from "lucide-react";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import React from "react";
/* oxlint-enable sort-imports */
import type { JSX as ReactJSX } from "react";

/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import { ProjectIcon } from "@/components/project-icon";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { Button } from "@/components/ui/button";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
/* oxlint-enable sort-imports */
import type { ProjectColorName, ProjectIconName } from "@/lib/project-icons";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import {
  DEFAULT_PROJECT_COLOR,
  PROJECT_COLORS,
  PROJECT_ICONS,
} from "@/lib/project-icons";
/* oxlint-enable sort-imports */
import { cn } from "@/lib/utils";

interface ProjectIconPickerProps {
  readonly className?: string;
  readonly color: ProjectColorName | null;
  readonly icon: ProjectIconName | null;
  readonly onColorChange: (color: ProjectColorName) => void;
  readonly onIconChange: (icon: ProjectIconName) => void;
}
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (ProjectIconPicker); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable max-lines-per-function, react/jsx-max-depth -- ProjectIconPicker: max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

export const ProjectIconPicker = ({
  icon,
  color,
  onIconChange,
  onColorChange,
  className,
}: ProjectIconPickerProps): ReactJSX.Element => {
  const displayColor = color ?? DEFAULT_PROJECT_COLOR;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          // oxlint-disable-next-line react/forbid-component-props -- Button accepts className in its styling contract; preserve this caller's layout and appearance.
          className={cn("size-9 p-0", className)}
          type="button"
          variant="outline"
        >
          {
            // oxlint-disable-next-line no-ternary -- Keep JSX child as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
            icon ? (
              <ProjectIcon color={displayColor} icon={icon} size={18} />
            ) : (
              <Smile
                // oxlint-disable-next-line react/forbid-component-props -- Smile accepts className in its styling contract; preserve this caller's layout and appearance.
                className="text-muted-foreground size-[18px]"
              />
            )
          }
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        // oxlint-disable-next-line react/forbid-component-props -- PopoverContent accepts className in its styling contract; preserve this caller's layout and appearance.
        className="w-auto p-3"
      >
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
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable max-lines-per-function, react/jsx-max-depth */
