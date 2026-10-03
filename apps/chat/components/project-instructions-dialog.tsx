"use client";
/* oxlint-disable sort-imports -- Oxfmt owns this module's external, type-only, and alias import groups; its case-insensitive order conflicts with this declaration-order rule. */

import React from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
/* oxlint-enable sort-imports */
/* oxlint-disable import/no-named-export, import/prefer-default-export, max-lines-per-function, no-ternary, react-perf/jsx-no-new-function-as-prop, react/forbid-component-props, react/jsx-max-depth, react/jsx-no-literals, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions -- ProjectInstructionsDialog: import/no-named-export: existing callers import this public component, type, or hook by name; import/prefer-default-export: the existing named import remains stable when this module adds another public declaration; max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; no-ternary: derive the existing render or state alternative inline without introducing another mutable state variable (including isPending ? "Saving..." : "Save instructions"); react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; react/forbid-component-props: className and style are the existing Tailwind and primitive composition API; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; react/jsx-no-literals: these existing labels and accessible text are this feature content; localization is a separate content migration; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including event); typescript/strict-boolean-expressions: the existing empty, missing, or optional value deliberately selects this feature fallback (including error). */

export const ProjectInstructionsDialog = ({
  open,
  onOpenChange,
  projectName,
  value,
  onValueChange,
  onSave,
  isPending,
  error,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectName?: string;
  value: string;
  onValueChange: (value: string) => void;
  onSave: () => void;
  isPending: boolean;
  error?: string;
}): React.JSX.Element => (
  <Dialog
    onOpenChange={(next) => {
      if (!isPending) {
        onOpenChange(next);
      }
    }}
    open={open}
  >
    <DialogContent className="sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>Set project instructions</DialogTitle>
        <DialogDescription>
          Provide instructions and information for new responses in{" "}
          {projectName ?? "this project"}.
        </DialogDescription>
      </DialogHeader>
      <div className="py-4">
        <Textarea
          aria-label="Project instructions"
          // oxlint-disable-next-line jsx-a11y/no-autofocus -- #536: Opening the instructions dialog intentionally focuses its editable instructions field.
          autoFocus
          className="min-h-[200px] resize-none"
          disabled={isPending}
          onChange={(event) => onValueChange(event.target.value)}
          placeholder="Enter project instructions..."
          value={value}
        />
      </div>
      {error && <p role="alert">{error}</p>}
      <DialogFooter>
        <Button
          disabled={isPending}
          onClick={() => onOpenChange(false)}
          type="button"
          variant="outline"
        >
          Cancel
        </Button>
        <Button disabled={isPending} onClick={onSave} type="button">
          {isPending ? "Saving..." : "Save instructions"}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);
/* oxlint-enable import/no-named-export, import/prefer-default-export, max-lines-per-function, no-ternary, react-perf/jsx-no-new-function-as-prop, react/forbid-component-props, react/jsx-max-depth, react/jsx-no-literals, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */
