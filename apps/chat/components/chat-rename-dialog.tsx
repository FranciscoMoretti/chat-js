"use client";

import type { JSX as ReactJSX } from "react";
import React, { useCallback, useEffect, useRef, useState } from "react";

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

interface RenameSubmission {
  readonly canDismiss: () => boolean;
  readonly clearError: () => void;
  readonly error: string;
  readonly isPending: boolean;
  readonly submit: () => void;
}

const renameErrorMessage = (error: unknown): string =>
  error instanceof Error && error.message !== ""
    ? error.message
    : "Could not rename chat. Try again.";

interface RenameSubmissionOptions {
  readonly chatTitle: string;
  readonly currentTitle: string;
  readonly isLoading: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onSubmit: (title: string) => Promise<void>;
}

const useRenamePromise = (
  {
    chatTitle,
    currentTitle,
    isLoading,
    onOpenChange,
    onSubmit,
  }: RenameSubmissionOptions,
  submissionInFlight: Readonly<{ current: boolean }>,
  updateSubmission: (pending: boolean, error?: string) => void
): (() => Promise<void>) =>
  useCallback(async (): Promise<void> => {
    const trimmedValue = chatTitle.trim();
    if (
      isLoading ||
      submissionInFlight.current ||
      trimmedValue === "" ||
      trimmedValue === currentTitle
    ) {
      return;
    }
    updateSubmission(true);
    try {
      await onSubmit(trimmedValue);
      onOpenChange(false);
    } catch (error: unknown) {
      updateSubmission(false, renameErrorMessage(error));
      return;
    }
    updateSubmission(false);
  }, [
    chatTitle,
    currentTitle,
    isLoading,
    onOpenChange,
    onSubmit,
    submissionInFlight,
    updateSubmission,
  ]);

const useRenameSubmission = (
  options: RenameSubmissionOptions
): RenameSubmission => {
  const { isLoading } = options;
  const [submission, setSubmission] = useState({ error: "", pending: false });
  const submissionInFlight = useRef(false);
  const updateSubmission = useCallback((pending: boolean, error = ""): void => {
    submissionInFlight.current = pending;
    setSubmission({ error, pending });
  }, []);
  const submitRename = useRenamePromise(
    options,
    submissionInFlight,
    updateSubmission
  );
  const submit = useCallback((): void => {
    void submitRename();
  }, [submitRename]);
  const canDismiss = useCallback(
    (): boolean => !isLoading && !submissionInFlight.current,
    [isLoading]
  );
  const clearError = useCallback((): void => {
    if (!submissionInFlight.current) {
      updateSubmission(false);
    }
  }, [updateSubmission]);
  return {
    canDismiss,
    clearError,
    error: submission.error,
    isPending: isLoading || submission.pending,
    submit,
  };
};

/* oxlint-disable max-lines-per-function, react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth -- ChatRenameDialog: max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; */

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
  const wasOpen = useRef(false);
  const { canDismiss, clearError, error, isPending, submit } =
    useRenameSubmission({
      chatTitle,
      currentTitle,
      isLoading,
      onOpenChange,
      onSubmit,
    });

  useEffect(() => {
    if (open && !wasOpen.current) {
      // Restore the latest committed title only when reopening, preserving edits during optimistic updates.
      setChatTitle(currentTitle);
      clearError();
    }
    wasOpen.current = open;
  }, [open, currentTitle, clearError]);

  const handleOpenChange = (newOpen: boolean): void => {
    if (!canDismiss()) {
      return;
    }
    if (!newOpen) {
      setChatTitle(currentTitle);
      clearError();
    }
    onOpenChange(newOpen);
  };

  const isDisabled =
    !chatTitle.trim() || chatTitle.trim() === currentTitle || isPending;

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
            disabled={isPending}
            maxLength={255}
            onChange={(event: {
              readonly target: { readonly value: string };
            }) => setChatTitle(event.target.value)}
            onKeyDown={(keyboardEvent: { readonly key: string }) => {
              if (keyboardEvent.key === "Enter") {
                submit();
              } else if (keyboardEvent.key === "Escape") {
                handleOpenChange(false);
              }
            }}
            placeholder="Chat name"
            value={chatTitle}
          />
        </div>
        {error !== "" && <p role="alert">{error}</p>}
        <DialogFooter>
          <Button
            disabled={isPending}
            onClick={() => handleOpenChange(false)}
            variant="outline"
          >
            Cancel
          </Button>
          <Button disabled={isDisabled} onClick={submit}>
            {isPending ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
/* oxlint-enable max-lines-per-function, react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth */
