"use client";

import { Button } from "@/components/ui/button";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import React from "react";

import { Textarea } from "@/components/ui/textarea";

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
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly projectName?: string;
  readonly value: string;
  readonly onValueChange: (value: string) => void;
  readonly onSave: () => void;
  readonly isPending: boolean;
  readonly error?: string;
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
          autoFocus
          className="min-h-[200px] resize-none"
          disabled={isPending}
          onChange={(event: {
            readonly target: { readonly value: string };
          }) => {
            onValueChange(event.target.value);
          }}
          placeholder="Enter project instructions..."
          value={value}
        />
      </div>
      {typeof error === "string" && error !== "" && <p role="alert">{error}</p>}
      <DialogFooter>
        <Button
          disabled={isPending}
          onClick={() => {
            onOpenChange(false);
          }}
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
