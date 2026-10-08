"use client";

import React, { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";

/* oxlint-disable sort-imports -- The combined development and production module-effect trace rejects swapping @/components/ui/button and @/components/ui/dialog; keep this adjacent import pair ordered. */
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
/* oxlint-enable sort-imports */

import { Input } from "@/components/ui/input";

import type { JSX as ReactJSX } from "react";
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (ChatRenameDialog); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable react/jsx-no-literals -- ChatRenameDialog renders authored interface labels, status copy and display punctuation; no translation-layer contract is defined here. */
/* oxlint-disable max-lines-per-function, react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth -- ChatRenameDialog: max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries;  */

// oxlint-disable-next-line max-statements -- Keep the dialog's draft, immediate submission lock and async error lifecycle together.
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

  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve handleSubmit's awaited sequencing and rejected-Promise behavior. */
  // oxlint-disable-next-line max-statements -- Keep completion, failure and lock release under the same dialog-session ownership check.
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
  /* oxlint-enable oxc/no-async-await */
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
    // oxlint-disable-next-line oxc/no-async-await -- React adopts the producer's existing completion after its urgent state updates.
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
            // oxlint-disable-next-line jsx-a11y/no-autofocus -- #536: Opening Rename Chat intentionally focuses the title field for keyboard editing.
            autoFocus
            maxLength={255}
            onChange={(event: {
              readonly target: { readonly value: string };
            }) => setChatTitle(event.target.value)}
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
          <Button onClick={() => handleOpenChange(false)} variant="outline">
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
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable react/jsx-no-literals */
/* oxlint-enable max-lines-per-function, react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth */
