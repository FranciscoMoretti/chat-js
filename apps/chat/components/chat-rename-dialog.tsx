"use client";

import { useEffect, useState } from "react";

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
