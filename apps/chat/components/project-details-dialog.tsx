"use client";
/* oxlint-disable sort-imports -- Oxfmt owns this module's external, type-only, and alias import groups; its case-insensitive order conflicts with this declaration-order rule. */

import React, { useEffect, useRef, useState } from "react";

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
/* oxlint-enable sort-imports */

/* oxlint-disable import/no-named-export -- ProjectDetailsData: import/no-named-export: existing callers import this public component, type, or hook by name. */

export interface ProjectDetailsData {
  color: ProjectColorName;
  icon: ProjectIconName;
  name: string;
}
/* oxlint-enable import/no-named-export */
/* oxlint-disable id-length, import/no-named-export, max-lines-per-function, max-statements, no-ternary, oxc/no-async-await, react-perf/jsx-no-new-function-as-prop, react/forbid-component-props, react/jsx-max-depth, react/jsx-no-literals, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-void-return, unicorn/no-null -- ProjectDetailsDialog: id-length: retain conventional event, index, and generic identifiers in this existing callback contract; import/no-named-export: existing callers import this public component, type, or hook by name; max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; max-statements: the ordered state transitions and rendering guards belong to this cohesive feature operation; no-ternary: derive the existing render or state alternative inline without introducing another mutable state variable (including mode === "create" ? "New Project" : "Edit Project"); oxc/no-async-await: await preserves ordered requests and catch behavior in this feature operation; react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; react/forbid-component-props: className and style are the existing Tailwind and primitive composition API; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; react/jsx-no-literals: these existing labels and accessible text are this feature content; localization is a separate content migration; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including data: ProjectDetailsData); typescript/strict-void-return: this library event API ignores the return value while the existing handler owns its async pending and error lifecycle; unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

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

  const submitChanges = async () => {
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

  const handleSubmit = async () => {
    setSubmitError("");
    try {
      await submitChanges();
    } catch {
      setSubmitError("Could not save project. Try again.");
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
            // oxlint-disable-next-line jsx-a11y/no-autofocus -- #536: Opening the project editor intentionally starts keyboard entry in the project name field.
            autoFocus
            className="flex-1"
            maxLength={255}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !isDisabled) {
                void handleSubmit();
              } else if (e.key === "Escape") {
                handleOpenChange(false);
              }
            }}
            placeholder="Project name"
            value={name}
          />
        </div>
        {submitError && <p role="alert">{submitError}</p>}
        <DialogFooter>
          <Button onClick={() => handleOpenChange(false)} variant="outline">
            Cancel
          </Button>
          <Button
            disabled={isDisabled}
            // oxlint-disable-next-line typescript/no-misused-promises -- #585: Project submission owns dialog state and failure feedback; the button only triggers that lifecycle.
            onClick={handleSubmit}
          >
            {buttonText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
/* oxlint-enable id-length, import/no-named-export, max-lines-per-function, max-statements, no-ternary, oxc/no-async-await, react-perf/jsx-no-new-function-as-prop, react/forbid-component-props, react/jsx-max-depth, react/jsx-no-literals, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-void-return, unicorn/no-null */
