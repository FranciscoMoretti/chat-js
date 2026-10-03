"use client";
/* oxlint-disable sort-imports -- Oxfmt owns this module's external, type-only, and alias import groups; its case-insensitive order conflicts with this declaration-order rule. */

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
/* oxlint-enable sort-imports */
/* oxlint-disable id-length, import/no-named-export, import/prefer-default-export, max-lines-per-function, oxc/no-async-await, react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth, react/jsx-no-literals, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-void-return -- ChatRenameDialog: id-length: retain conventional event, index, and generic identifiers in this existing callback contract; import/no-named-export: existing callers import this public component, type, or hook by name; import/prefer-default-export: the existing named import remains stable when this module adds another public declaration; max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; oxc/no-async-await: await preserves ordered requests and catch behavior in this feature operation; react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; react/jsx-no-literals: these existing labels and accessible text are this feature content; localization is a separate content migration; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including e); typescript/strict-void-return: this library event API ignores the return value while the existing handler owns its async pending and error lifecycle. */

export const ChatRenameDialog = ({
  open,
  onOpenChange,
  currentTitle,
  onSubmit,
  isLoading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentTitle: string;
  onSubmit: (title: string) => Promise<void>;
  isLoading: boolean;
}) => {
  const [chatTitle, setChatTitle] = useState(currentTitle);

  useEffect(() => {
    if (open) {
      // oxlint-disable-next-line react/set-state-in-effect -- Reopen the controlled dialog with the latest title.
      setChatTitle(currentTitle);
    }
  }, [open, currentTitle]);

  const handleSubmit = async () => {
    const trimmedValue = chatTitle.trim();
    if (trimmedValue && trimmedValue !== currentTitle) {
      await onSubmit(trimmedValue);
    }
    onOpenChange(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
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
            onChange={(e) => setChatTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                void handleSubmit();
              } else if (e.key === "Escape") {
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
            // oxlint-disable-next-line typescript/no-misused-promises -- #585: Rename submission catches failures and reports them while owning dialog pending state.
            onClick={handleSubmit}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
/* oxlint-enable id-length, import/no-named-export, import/prefer-default-export, max-lines-per-function, oxc/no-async-await, react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth, react/jsx-no-literals, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-void-return */
