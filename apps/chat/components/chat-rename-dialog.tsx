"use client";

import type { JSX as ReactJSX } from "react";
import React, { useEffect, useState } from "react";

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
/* oxlint-disable max-lines-per-function, react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth, typescript/strict-void-return -- ChatRenameDialog: max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including event); typescript/strict-void-return: this library event API ignores the return value while the existing handler owns its async pending and error lifecycle. */

export const ChatRenameDialog = ({
  open,
  onOpenChange,
  currentTitle,
  onSubmit,
  isLoading,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly currentTitle: string;
  readonly onSubmit: (title: string) => Promise<void>;
  readonly isLoading: boolean;
}): ReactJSX.Element => {
  const [chatTitle, setChatTitle] = useState(currentTitle);

  useEffect(() => {
    if (open) {
      // oxlint-disable-next-line react/set-state-in-effect -- Reopen the controlled dialog with the latest title.
      setChatTitle(currentTitle);
    }
  }, [open, currentTitle]);

  const handleSubmit = async (): Promise<void> => {
    const trimmedValue = chatTitle.trim();
    if (trimmedValue && trimmedValue !== currentTitle) {
      await onSubmit(trimmedValue);
    }
    onOpenChange(false);
  };

  const handleOpenChange = (newOpen: boolean): void => {
    if (!newOpen) {
      setChatTitle(currentTitle);
    }
    onOpenChange(newOpen);
  };

  const isDisabled =
    !chatTitle.trim() || chatTitle.trim() === currentTitle || isLoading;

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename Chat</DialogTitle>
          <DialogDescription>Enter a new name for this chat.</DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Input
            // oxlint-disable-next-line jsx-a11y/no-autofocus -- #536: Opening Rename Chat intentionally focuses the title field for keyboard editing.
            autoFocus
            maxLength={255}
            onChange={(event: {
              readonly target: { readonly value: string };
            }) => setChatTitle(event.target.value)}
            onKeyDown={(keyboardEvent: { readonly key: string }) => {
              if (keyboardEvent.key === "Enter") {
                void handleSubmit();
              } else if (keyboardEvent.key === "Escape") {
                handleOpenChange(false);
              }
            }}
            placeholder="Chat name"
            value={chatTitle}
          />
        </div>
        <DialogFooter>
          <Button onClick={() => handleOpenChange(false)} variant="outline">
            Cancel
          </Button>
          <Button
            disabled={isDisabled}
            // oxlint-disable-next-line typescript/no-misused-promises -- #585: Preserve the existing async click handler contract; pending/error UX belongs in a separate behavior change.
            onClick={handleSubmit}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
/* oxlint-enable max-lines-per-function, react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth, typescript/strict-void-return */
