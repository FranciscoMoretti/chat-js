"use client";
/* oxlint-disable sort-imports -- Oxfmt owns this module's external, type-only, and alias import groups; its case-insensitive order conflicts with this declaration-order rule. */

import { Pencil } from "lucide-react";
import React from "react";

import { ProjectIcon } from "@/components/project-icon";
import { Button } from "@/components/ui/button";
import type { ProjectColorName, ProjectIconName } from "@/lib/project-icons";
/* oxlint-enable sort-imports */
/* oxlint-disable import/no-named-export, import/prefer-default-export, max-lines-per-function, no-ternary, oxc/no-optional-chaining, react/forbid-component-props, react/jsx-max-depth, react/jsx-no-literals, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions -- ProjectConfig: import/no-named-export: existing callers import this public component, type, or hook by name; import/prefer-default-export: the existing named import remains stable when this module adds another public declaration; max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; no-ternary: derive the existing render or state alternative inline without introducing another mutable state variable; oxc/no-optional-chaining: optional access preserves the absent prop, query result, or browser capability fallback (including instructions?.trim()); react/forbid-component-props: className and style are the existing Tailwind and primitive composition API; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; react/jsx-no-literals: these existing labels and accessible text are this feature content; localization is a separate content migration; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types; typescript/strict-boolean-expressions: the existing empty, missing, or optional value deliberately selects this feature fallback (including projectName). */

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
/* oxlint-enable import/no-named-export, import/prefer-default-export, max-lines-per-function, no-ternary, oxc/no-optional-chaining, react/forbid-component-props, react/jsx-max-depth, react/jsx-no-literals, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */
