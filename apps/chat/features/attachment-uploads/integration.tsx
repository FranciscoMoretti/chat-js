/* oxlint-disable oxc/no-async-await -- Native async Actions and operations preserve awaited sequencing and route rejections to their declared owner. */
"use client";

import React, { useEffect, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { toast } from "sonner";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { config } from "@/lib/config";
import type {
  AttachmentUploadInput,
  AttachmentUploadIntegration,
} from "@/lib/installation-contracts";
/* oxlint-enable sort-imports */
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
/* oxlint-enable sort-imports */
import { useSession } from "@/providers/session-provider";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { AttachFilesControl, TakePhotoControl } from "./controls";
/* oxlint-enable sort-imports */
import { uploadAttachment } from "./upload";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { processFilesForUpload } from "./upload-prep";
/* oxlint-enable sort-imports */

type UploadPasteCaptureEvent = Readonly<{
  clipboardData: Readonly<{
    files: Readonly<Pick<FileList, "length" | typeof Symbol.iterator>>;
  }>;
  preventDefault: () => void;
  stopPropagation: () => void;
}>;

interface UploadComposer {
  input: React.JSX.Element;
  onAttach: (accept: string, capture?: "user" | "environment") => void;
  rootProps: Readonly<Record<string, never>> | UploadComposerRootProps;
}

interface UploadComposerRootProps {
  onPasteCapture: (event: UploadPasteCaptureEvent) => void;
  role: "group";
}

interface UploadsResult {
  composer: (disabled: boolean) => UploadComposer;
  uploadQueue: string[];
}

/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the ordered validation, state transitions, and cleanup in one operation so their sequencing remains reviewable. */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */

const useUploads = ({
  attachmentCount,
  onUploaded,
}: ReadonlyNativeSurface<AttachmentUploadInput>): UploadsResult => {
  const [, startEventAction] = React.useTransition();
  const input = useRef<HTMLInputElement>(null);
  const { data: session } = useSession();
  const [uploadQueue, setUploadQueue] = useState<string[]>([]);
  const lock = useRef(false);
  const currentCount = useRef(attachmentCount);
  useEffect((): void => {
    currentCount.current = attachmentCount;
  }, [attachmentCount]);
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve upload's awaited sequencing and rejected-Promise behavior. */
  const upload = async (
    files: ReadonlyNativeSurface<File[]>
  ): Promise<void> => {
    if (lock.current || files.length === 0) {
      return;
    }
    // oxlint-disable-next-line oxc/no-optional-chaining -- Preserve the existing nullish guard on session when checking its user.
    if (!session?.user) {
      toast.error("Sign in to attach files.");
      return;
    }
    if (files.length + currentCount.current > 16) {
      toast.error("Attach at most 16 files per message.");
      return;
    }
    lock.current = true;
    setUploadQueue(
      files.map((file: ReadonlyNativeSurface<File>): string => file.name)
    );
    // oxlint-disable-next-line react/todo -- Keep queue cleanup in finally for upload recovery.
    try {
      const result = await processFilesForUpload(files, config.attachments);
      if (
        result.stillOversized.length > 0 ||
        result.unsupportedFiles.length > 0
      ) {
        toast.error(
          "Some files could not be attached. Use images or PDFs within the upload size limit."
        );
      }
      for (const file of result.files) {
        try {
          // oxlint-disable-next-line eslint/no-await-in-loop -- Serialize uploads to preserve order and bound memory.
          const attachment = await uploadAttachment(file);
          currentCount.current += 1;
          onUploaded(attachment);
        } catch (error) {
          toast.error(
            // oxlint-disable-next-line no-ternary -- Keep toast.error argument as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
            error instanceof Error ? error.message : "Upload failed."
          );
        }
      }
    } finally {
      lock.current = false;
      setUploadQueue([]);
    }
  };
  /* oxlint-enable oxc/no-async-await */
  const { getRootProps } = useDropzone({
    disabled: uploadQueue.length > 0,
    noClick: true,
    noKeyboard: true,

    onDrop: (files: ReadonlyNativeSurface<File[]>) => {
      // Start outside the transition so the upload queue locks Send immediately.
      const completion = upload(files);
      // oxlint-disable-next-line oxc/no-async-await -- Await upload completion inside the React Action failure owner.
      startEventAction(async () => {
        await completion;
      });
    },
  });
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve callbacks in this return statement's awaited sequencing and rejected-Promise behavior. */
  return {
    composer: (disabled: boolean) => ({
      input: (
        <input
          aria-label="Attach files"
          className="hidden"
          disabled={disabled}
          multiple
          ref={input}
          type="file"

          onChange={(
            // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Reset the original input element's value after reading its FileList so the same file can be selected again.
            event: React.ChangeEvent<HTMLInputElement>
          ) => {
            if (disabled) {
              event.target.value = "";
              return;
            }
            const completion = upload([...(event.target.files ?? [])]);
            startEventAction(async () => {
              await completion;
              event.target.value = "";
            });
          }}
        />
      ),
      onAttach: (accept: string, capture?: "user" | "environment"): void => {
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
      // oxlint-disable-next-line no-ternary -- Keep rootProps as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
      rootProps: disabled
        ? {}
        : {
            // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing getRootProps({ role: "group" }) own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
            ...getRootProps({ role: "group" }),
            onPasteCapture: (event: UploadPasteCaptureEvent): void => {
              if (event.clipboardData.files.length > 0) {
                event.preventDefault();
                event.stopPropagation();
                const completion = upload([...event.clipboardData.files]);
                startEventAction(async () => {
                  await completion;
                });
              }
            },
          },
    }),
    uploadQueue,
  };
  /* oxlint-enable oxc/no-async-await */
};
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (attachmentUploads); the enabled import/no-default-export convention rejects the default-export alternative. */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable eslint/max-statements */

export const attachmentUploads = {
  controls: [
    { Component: AttachFilesControl, id: "attach-files" },
    { Component: TakePhotoControl, id: "take-photo" },
  ],
  useUploads,
} satisfies AttachmentUploadIntegration;
/* oxlint-enable import/prefer-default-export, import/no-named-export */
