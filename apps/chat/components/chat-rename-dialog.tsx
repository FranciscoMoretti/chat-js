"use client";

import React, { useEffect, useRef, useState } from "react";

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

import type { JSX as ReactJSX } from "react";

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
  const [, startEventAction] = React.useTransition();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submissionLock = useRef(false);
  const submissionSession = useRef(Symbol("rename dialog session"));
  const [chatTitle, setChatTitle] = useState(currentTitle);
  const [submitError, setSubmitError] = useState("");

  const wasOpen = useRef(false);
  useEffect(
    (): (() => void) => (): void => {
      // A conditionally mounted caller can reopen a new instance while this work settles.
      submissionSession.current = Symbol("rename dialog session");
    },
    []
  );
  useEffect(() => {
    if (open && !wasOpen.current) {
      setChatTitle(currentTitle);
      setSubmitError("");
    }
    if (!open && wasOpen.current) {
      submissionSession.current = Symbol("rename dialog session");
      submissionLock.current = false;

      setIsSubmitting(false);
    }
    wasOpen.current = open;
  }, [open, currentTitle]);

  const handleSubmit = async (): Promise<void> => {
    const session = submissionSession.current;
    setIsSubmitting(true);
    setSubmitError("");
    try {
      const trimmedValue = chatTitle.trim();
      if (trimmedValue && trimmedValue !== currentTitle) {
        await onSubmit(trimmedValue);
      }
      if (session === submissionSession.current) {
        onOpenChange(false);
      }
    } catch {
      if (session === submissionSession.current) {
        setSubmitError("Could not rename chat. Try again.");
      }
    }
    if (session === submissionSession.current) {
      submissionLock.current = false;
      setIsSubmitting(false);
    }
  };
  const handleOpenChange = (newOpen: boolean): void => {
    if (!newOpen) {
      submissionSession.current = Symbol("rename dialog session");
      submissionLock.current = false;
      setIsSubmitting(false);
      setChatTitle(currentTitle);
    }
    onOpenChange(newOpen);
  };

  const isDisabled =
    !chatTitle.trim() ||
    chatTitle.trim() === currentTitle ||
    isLoading ||
    isSubmitting;
  const submitRename = (): void => {
    if (isLoading || isSubmitting || submissionLock.current) {
      return;
    }
    // Lock before React commits so Save and Enter cannot race in one event turn.
    submissionLock.current = true;
    // Publish pending state immediately, then give React the same completion.
    const completion = handleSubmit();
    startEventAction(async () => {
      await completion;
    });
  };

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename Chat</DialogTitle>
          <DialogDescription>Enter a new name for this chat.</DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Input
            autoFocus
            maxLength={255}
            onChange={(event: {
              readonly target: { readonly value: string };
            }) => {
              setChatTitle(event.target.value);
            }}
            onKeyDown={(keyboardEvent: { readonly key: string }) => {
              if (keyboardEvent.key === "Enter") {
                submitRename();
              } else if (keyboardEvent.key === "Escape") {
                handleOpenChange(false);
              }
            }}
            placeholder="Chat name"
            value={chatTitle}
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
          <Button disabled={isDisabled} onClick={submitRename}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
