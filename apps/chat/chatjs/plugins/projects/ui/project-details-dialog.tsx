"use client";

import React, { useEffect, useRef, useState } from "react";

import {
  DEFAULT_PROJECT_COLOR,
  DEFAULT_PROJECT_ICON,
} from "@/chatjs/plugins/projects/project-icons";

import { ProjectIconPicker } from "@/chatjs/plugins/projects/ui/project-icon-picker";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import type {
  ProjectColorName,
  ProjectIconName,
} from "@/chatjs/plugins/projects/project-icons";

import { Button } from "@/components/ui/button";

import { Input } from "@/components/ui/input";

import type { JSX as ReactJSX } from "react";

export interface ProjectDetailsData {
  readonly color: ProjectColorName;
  readonly icon: ProjectIconName;
  readonly name: string;
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
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly mode: "create" | "edit";
  readonly initialName?: string;
  readonly initialIcon?: ProjectIconName;
  readonly initialColor?: ProjectColorName;
  readonly onSubmit: (data: ProjectDetailsData) => void | Promise<void>;
  readonly isLoading: boolean;
}): ReactJSX.Element => {
  const [, startEventAction] = React.useTransition();
  const [submitError, setSubmitError] = useState("");
  const [name, setName] = useState(initialName ?? "");
  const [icon, setIcon] = useState<ProjectIconName | null>(initialIcon ?? null);
  const [color, setColor] = useState<ProjectColorName | null>(
    initialColor ?? null
  );

  const wasOpen = useRef(false);
  useEffect(() => {
    if (open && !wasOpen.current) {
      setSubmitError("");
      setName(initialName ?? "");
      setIcon(initialIcon ?? null);
      setColor(initialColor ?? null);
    }
    wasOpen.current = open;
  }, [open, initialName, initialIcon, initialColor]);

  // Computed values for submission
  const finalIcon = icon ?? DEFAULT_PROJECT_ICON;
  const finalColor = color ?? DEFAULT_PROJECT_COLOR;

  const submitChanges = async (): Promise<void> => {
    const trimmedName = name.trim();

    if (mode === "create") {
      if (trimmedName) {
        await onSubmit({
          color: finalColor,
          icon: finalIcon,
          name: trimmedName,
        });
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
          color: finalColor,
          icon: finalIcon,
          name: trimmedName,
        });
      }
      onOpenChange(false);
    } else {
      onOpenChange(false);
    }
  };
  const handleSubmit = async (): Promise<void> => {
    setSubmitError("");
    try {
      await submitChanges();
    } catch {
      setSubmitError("Could not save project. Try again.");
    }
  };
  const handleOpenChange = (newOpen: boolean): void => {
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
            onChange={(event: {
              readonly target: { readonly value: string };
            }) => {
              setName(event.target.value);
            }}
            onKeyDown={(keyboardEvent: { readonly key: string }) => {
              if (keyboardEvent.key === "Enter" && !isDisabled) {
                void handleSubmit();
              } else if (keyboardEvent.key === "Escape") {
                handleOpenChange(false);
              }
            }}
            placeholder="Project name"
            value={name}
          />
        </div>
        {submitError && <p role="alert">{submitError}</p>}
        <DialogFooter>
          <Button
            onClick={() => {
              handleOpenChange(false);
            }}
            variant="outline"
          >
            Cancel
          </Button>
          <Button
            disabled={isDisabled}

            onClick={() => {
              startEventAction(handleSubmit);
            }}
          >
            {buttonText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
