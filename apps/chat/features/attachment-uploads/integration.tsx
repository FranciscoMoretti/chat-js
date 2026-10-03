"use client";

import React, { useEffect, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import { toast } from "sonner";
/* oxlint-enable eslint/sort-imports */

/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import { config } from "@/lib/config";
/* oxlint-enable eslint/sort-imports */
/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import type {
  AttachmentUploadIntegration,
  AttachmentUploadInput,
} from "@/lib/installation-contracts";
/* oxlint-enable eslint/sort-imports */
import { useSession } from "@/providers/session-provider";

/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import { AttachFilesControl, TakePhotoControl } from "./controls";
/* oxlint-enable eslint/sort-imports */
import { uploadAttachment } from "./upload";
/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import { processFilesForUpload } from "./upload-prep";
/* oxlint-enable eslint/sort-imports */

/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the ordered validation, state transitions, and cleanup in one operation so their sequencing remains reviewable. */
/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
/* oxlint-disable oxc/no-async-await -- Await preserves the existing sequencing, rejection propagation, and cleanup behavior of this asynchronous operation. */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
/* oxlint-disable oxc/no-optional-chaining -- Optional access deliberately propagates absence from the external or partially initialized data contract. */
/* oxlint-disable eslint/no-ternary -- This expression selects a value without introducing mutable intermediate state or changing evaluation order. */
/* oxlint-disable react-perf/jsx-no-new-function-as-prop -- The handler captures the current render state; changing its identity policy requires profiling and lifecycle review. */
/* oxlint-disable oxc/no-rest-spread-properties -- Copying these properties preserves immutable updates and the existing structural API without mutating the source object. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
/* oxlint-disable typescript/strict-void-return -- The receiving framework deliberately ignores this callback result and owns its completion/error handling. */
const useUploads = ({ attachmentCount, onUploaded }: AttachmentUploadInput) => {
  const input = useRef<HTMLInputElement>(null);
  const { data: session } = useSession();
  const [uploadQueue, setUploadQueue] = useState<string[]>([]);
  const lock = useRef(false);
  const currentCount = useRef(attachmentCount);
  useEffect((): void => {
    currentCount.current = attachmentCount;
  }, [attachmentCount]);
  const upload = async (files: File[]): Promise<void> => {
    if (lock.current || files.length === 0) {
      return;
    }
    if (!session?.user) {
      toast.error("Sign in to attach files.");
      return;
    }
    if (files.length + currentCount.current > 16) {
      toast.error("Attach at most 16 files per message.");
      return;
    }
    lock.current = true;
    setUploadQueue(files.map((file): string => file.name));
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
            error instanceof Error ? error.message : "Upload failed."
          );
        }
      }
    } finally {
      lock.current = false;
      setUploadQueue([]);
    }
  };
  const { getRootProps } = useDropzone({
    disabled: uploadQueue.length > 0,
    noClick: true,
    noKeyboard: true,
    // oxlint-disable-next-line typescript/no-misused-promises -- The upload helper reports failures and settles UI state internally; the DOM/dropzone callback does not consume its promise.
    onDrop: upload,
  });
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
          // oxlint-disable-next-line typescript/no-misused-promises -- The upload helper reports failures and settles UI state internally; the DOM/dropzone callback does not consume its promise.
          onChange={async (event): Promise<void> => {
            if (!disabled) {
              await upload([...(event.target.files ?? [])]);
            }
            event.target.value = "";
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
      rootProps: disabled
        ? {}
        : {
            ...getRootProps({ role: "group" }),
            onPasteCapture: (
              event: React.ClipboardEvent<HTMLDivElement>
            ): void => {
              if (event.clipboardData.files.length > 0) {
                event.preventDefault();
                event.stopPropagation();
                void upload([...event.clipboardData.files]);
              }
            },
          },
    }),
    uploadQueue,
  };
};
/* oxlint-enable typescript/strict-void-return */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable oxc/no-rest-spread-properties */
/* oxlint-enable react-perf/jsx-no-new-function-as-prop */
/* oxlint-enable eslint/no-ternary */
/* oxlint-enable oxc/no-optional-chaining */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable eslint/max-statements */

/* oxlint-disable import/prefer-default-export -- Keep the named import contract used by registry consumers and package callers even when this module exposes one value. */
/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
export const attachmentUploads = {
  controls: [
    { Component: AttachFilesControl, id: "attach-files" },
    { Component: TakePhotoControl, id: "take-photo" },
  ],
  useUploads,
} satisfies AttachmentUploadIntegration;
/* oxlint-enable import/no-named-export */
/* oxlint-enable import/prefer-default-export */
