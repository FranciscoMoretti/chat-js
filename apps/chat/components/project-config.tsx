"use client";

import type { ProjectColorName, ProjectIconName } from "@/lib/project-icons";
import { Pencil } from "lucide-react";

import { ProjectIcon } from "@/components/project-icon";

/* oxlint-disable sort-imports -- The combined development and production module-effect trace rejects swapping @/components/project-icon and @/components/ui/button; keep this adjacent import pair ordered. */
import { Button } from "@/components/ui/button";
/* oxlint-enable sort-imports */

import React from "react";
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (ProjectConfig); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable react/jsx-no-literals -- ProjectConfig renders authored interface labels, status copy and display punctuation; no translation-layer contract is defined here. */

/* oxlint-disable max-lines-per-function, react/jsx-max-depth -- max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries. */

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
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading trim from instructions; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
  const hasInstructions = Boolean(instructions?.trim());

  return (
    <div className="flex items-center justify-between gap-4">
      {/* oxlint-disable no-ternary -- Keep the empty or missing project name as the exact false-branch React child. */}
      {typeof projectName === "string" && projectName !== "" ? (
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
      ) : (
        projectName
      )}

      <Button
        // oxlint-disable-next-line react/forbid-component-props -- Button accepts className in its styling contract; preserve this caller's layout and appearance.
        className="rounded-full"
        onClick={onEditInstructions}
        size="sm"
        type="button"
        variant="outline"
      >
        {
          // oxlint-disable-next-line no-ternary -- Keep JSX child as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
          hasInstructions ? (
            <span aria-hidden="true" className="text-sm leading-none">
              ✓
            </span>
          ) : (
            <span aria-hidden="true" className="text-base leading-none">
              +
            </span>
          )
        }
        Instructions
      </Button>
    </div>
  );
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable react/jsx-no-literals */
/* oxlint-enable max-lines-per-function, react/jsx-max-depth */
