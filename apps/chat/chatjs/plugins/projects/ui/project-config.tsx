"use client";

import type {
  ProjectColorName,
  ProjectIconName,
} from "@/chatjs/plugins/projects/project-icons";
import { Pencil } from "lucide-react";

import { ProjectIcon } from "@/chatjs/plugins/projects/ui/project-icon";

import { Button } from "@/components/ui/button";

import React from "react";

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
      {typeof projectName === "string" && projectName !== "" ? (
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
      ) : (
        projectName
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
