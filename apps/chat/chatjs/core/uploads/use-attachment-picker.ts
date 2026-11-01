"use client";

import { useRef, useTransition } from "react";
import type { ClipboardEvent, DragEvent, ChangeEvent } from "react";

/** DOM input adapters only. Upload policy, preprocessing and delivery belong to enqueue. */
export const useAttachmentPicker = ({
  disabled,
  onFiles,
}: {
  readonly disabled: boolean;
  readonly onFiles: (files: readonly File[]) => Promise<void>;
}) => {
  const input = useRef<HTMLInputElement>(null);
  const [, startAction] = useTransition();
  const submit = (files: readonly File[]): void => {
    if (disabled || files.length === 0) {
      return;
    }
    // Start before the transition so the queue blocks Send synchronously.
    const completion = onFiles(files);
    startAction(async () => {
      await completion;
    });
  };
  return {
    inputProps: {
      "aria-label": "Attach files",
      className: "hidden",
      disabled,
      multiple: true,
      ref: input,
      type: "file",
      onChange: (event: ChangeEvent<HTMLInputElement>): void => {
        const files = [...(event.currentTarget.files ?? [])];
        event.currentTarget.value = "";
        submit(files);
      },
    },
    rootProps: {
      onDragOver: (event: DragEvent<HTMLDivElement>): void => {
        if (!event.dataTransfer.types.includes("Files")) {
          return;
        }
        event.preventDefault();
        if (disabled) {
          event.dataTransfer.dropEffect = "none";
        }
      },
      onDrop: (event: DragEvent<HTMLDivElement>): void => {
        if (event.dataTransfer.files.length === 0) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        if (disabled) {
          return;
        }
        submit([...event.dataTransfer.files]);
      },
      onPasteCapture: (event: ClipboardEvent<HTMLDivElement>): void => {
        if (disabled || event.clipboardData.files.length === 0) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        submit([...event.clipboardData.files]);
      },
    },
    open: (accept: string, capture?: "user" | "environment"): void => {
      if (disabled || !input.current) {
        return;
      }
      input.current.accept = accept;
      if (capture) {
        input.current.capture = capture;
      } else {
        input.current.removeAttribute("capture");
      }
      input.current.click();
    },
  };
};
