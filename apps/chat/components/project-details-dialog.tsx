"use client";

import { useEffect, useState } from "react";

import { ProjectIconPicker } from "@/components/project-icon-picker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { ProjectColorName, ProjectIconName } from "@/lib/project-icons";
import {
  DEFAULT_PROJECT_COLOR,
  DEFAULT_PROJECT_ICON,
} from "@/lib/project-icons";

export interface ProjectDetailsData {
  color: ProjectColorName;
  icon: ProjectIconName;
  name: string;
}

export const ProjectDetailsDialog = ({
  open,
  onOpenChange,
  mode,
  initialName,
  initialIcon,
  initialColor,
  onSubmit,
  isLoading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initialName?: string;
  initialIcon?: ProjectIconName;
  initialColor?: ProjectColorName;
  onSubmit: (data: ProjectDetailsData) => void | Promise<void>;
  isLoading: boolean;
}) => {
  const [name, setName] = useState(initialName ?? "");
  const [icon, setIcon] = useState<ProjectIconName | null>(initialIcon ?? null);
  const [color, setColor] = useState<ProjectColorName | null>(
    initialColor ?? null
  );

  useEffect(() => {
    if (open) {
      setName(initialName ?? "");
      setIcon(initialIcon ?? null);
      setColor(initialColor ?? null);
    }
  }, [open, initialName, initialIcon, initialColor]);

  // Computed values for submission
  const finalIcon = icon ?? DEFAULT_PROJECT_ICON;
  const finalColor = color ?? DEFAULT_PROJECT_COLOR;

  const handleSubmit = async () => {
    const trimmedName = name.trim();

    if (mode === "create") {
      if (trimmedName) {
        onSubmit({ name: trimmedName, icon: finalIcon, color: finalColor });
        setName("");
        setIcon(null);
        setColor(null);
      }
    } else if (trimmedName) {
      const hasChanges =
        trimmedName !== initialName ||
        finalIcon !== (initialIcon ?? DEFAULT_PROJECT_ICON) ||
        finalColor !== (initialColor ?? DEFAULT_PROJECT_COLOR);
      if (hasChanges) {
        await onSubmit({
          name: trimmedName,
          icon: finalIcon,
          color: finalColor,
        });
      }
      onOpenChange(false);
    } else {
      onOpenChange(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setName(initialName ?? "");
      setIcon(initialIcon ?? null);
      setColor(initialColor ?? null);
    }
    onOpenChange(newOpen);
  };

  const hasName = Boolean(name.trim());
  const isUnchanged =
    name.trim() === initialName &&
    finalIcon === initialIcon &&
    finalColor === initialColor;

  const isDisabled = !hasName || isLoading || (mode === "edit" && isUnchanged);

  const title = mode === "create" ? "New Project" : "Edit Project";
  const description =
    mode === "create"
      ? "Create a new project to organize your chats."
      : "Update project details.";
  const buttonText = mode === "create" ? "Create" : "Save";

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2 py-4">
          <ProjectIconPicker
            color={color}
            icon={icon}
            onColorChange={setColor}
            onIconChange={setIcon}
          />
          <Input
            autoFocus
            className="flex-1"
            maxLength={255}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !isDisabled) {
                handleSubmit();
              } else if (e.key === "Escape") {
                handleOpenChange(false);
              }
            }}
            placeholder="Project name"
            value={name}
          />
        </div>
        <DialogFooter>
          <Button onClick={() => handleOpenChange(false)} variant="outline">
            Cancel
          </Button>
          <Button disabled={isDisabled} onClick={handleSubmit}>
            {buttonText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
