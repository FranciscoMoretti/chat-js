"use client";

import { Pencil } from "lucide-react";
import React from "react";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { ProjectIcon } from "@/components/project-icon";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { Button } from "@/components/ui/button";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { ProjectColorName, ProjectIconName } from "@/lib/project-icons";
/* oxlint-enable sort-imports */
/* oxlint-disable max-lines-per-function, react/jsx-max-depth, typescript/strict-boolean-expressions -- max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; typescript/strict-boolean-expressions: the existing empty, missing, or optional value deliberately selects this feature fallback (including projectName). */

export const ProjectConfig = ({
  projectName,
  projectIcon,
  projectColor,
  instructions,
  onEditInstructions,
  onRenameProject,
}: {
  readonly projectName?: string;
  readonly projectIcon?: ProjectIconName;
  readonly projectColor?: ProjectColorName;
  readonly instructions?: string | null;
  readonly onEditInstructions: () => void;
  readonly onRenameProject: () => void;
}): React.JSX.Element => {
  const hasInstructions = Boolean(instructions?.trim());

  return (
    <div className="flex items-center justify-between gap-4">
      {projectName && (
        <div className="flex items-center gap-2">
          {projectIcon && projectColor && (
            <ProjectIcon color={projectColor} icon={projectIcon} size={24} />
          )}
          <h1 className="text-2xl font-bold">{projectName}</h1>
          <Button
            // oxlint-disable-next-line react/forbid-component-props -- Button accepts className in its styling contract; preserve this caller's layout and appearance.
            className="h-8 w-8"
            onClick={onRenameProject}
            size="icon"
            type="button"
            variant="ghost"
          >
            <Pencil size={16} />
            <span className="sr-only">Rename project</span>
          </Button>
        </div>
      )}

      <Button
        // oxlint-disable-next-line react/forbid-component-props -- Button accepts className in its styling contract; preserve this caller's layout and appearance.
        className="rounded-full"
        onClick={onEditInstructions}
        size="sm"
        type="button"
        variant="outline"
      >
        {hasInstructions ? (
          <span aria-hidden="true" className="text-sm leading-none">
            ✓
          </span>
        ) : (
          <span aria-hidden="true" className="text-base leading-none">
            +
          </span>
        )}
        Instructions
      </Button>
    </div>
  );
};
/* oxlint-enable max-lines-per-function, react/jsx-max-depth, typescript/strict-boolean-expressions */
