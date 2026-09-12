"use client";

import { Pencil } from "lucide-react";

import { ProjectIcon } from "@/components/project-icon";
import { Button } from "@/components/ui/button";
import type { ProjectColorName, ProjectIconName } from "@/lib/project-icons";

export function ProjectConfig({
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
}) {
  const hasInstructions = !!instructions?.trim();

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
          <span className="text-sm leading-none">✓</span>
        ) : (
          <span className="text-base leading-none">+</span>
        )}
        Instructions
      </Button>
    </div>
  );
}
