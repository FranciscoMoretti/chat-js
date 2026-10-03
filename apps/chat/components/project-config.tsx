"use client";

import { Pencil } from "lucide-react";
import React from "react";

import { ProjectIcon } from "@/components/project-icon";
import { Button } from "@/components/ui/button";
import type { ProjectColorName, ProjectIconName } from "@/lib/project-icons";
/* oxlint-disable max-lines-per-function, react/forbid-component-props, react/jsx-max-depth, react/jsx-no-literals, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions -- ProjectConfig: ; max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; react/forbid-component-props: className and style are the existing Tailwind and primitive composition API; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; react/jsx-no-literals: these existing labels and accessible text are this feature content; localization is a separate content migration; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types; typescript/strict-boolean-expressions: the existing empty, missing, or optional value deliberately selects this feature fallback (including projectName). */

export const ProjectConfig = ({
  projectName,
  projectIcon,
  projectColor,
  instructions,
  onEditInstructions,
  onRenameProject,
}: {
  projectName?: string;
  projectIcon?: ProjectIconName;
  projectColor?: ProjectColorName;
  instructions?: string | null;
  onEditInstructions: () => void;
  onRenameProject: () => void;
}) => {
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
/* oxlint-enable max-lines-per-function, react/forbid-component-props, react/jsx-max-depth, react/jsx-no-literals, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */
