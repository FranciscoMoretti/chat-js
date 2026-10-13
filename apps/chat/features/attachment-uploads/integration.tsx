"use client";

import type {
  AttachmentUploadInput,
  AttachmentUploadIntegration,
} from "@/lib/installation-contracts";

import React, { useEffect, useRef, useState } from "react";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";

import { config } from "@/lib/config";
import { useSession } from "@/providers/session-provider";

import { AttachFilesControl, TakePhotoControl } from "./controls";
import { uploadAttachment } from "./upload";
import { processFilesForUpload } from "./upload-prep";

const withUploadCleanup = async (
  upload: () => Promise<void>,
  release: () => void
): Promise<void> => {
  try {
    await upload();
  } finally {
    release();
  }
};

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
  const upload = async (
    files: ReadonlyNativeSurface<File[]>
  ): Promise<void> => {
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
    setUploadQueue(
      files.map((file: ReadonlyNativeSurface<File>): string => file.name)
    );
    await withUploadCleanup(
      async () => {
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
      },
      () => {
        lock.current = false;
        setUploadQueue([]);
      }
    );
  };
  const { getRootProps } = useDropzone({
    disabled: uploadQueue.length > 0,
    noClick: true,
    noKeyboard: true,

    onDrop: (files: ReadonlyNativeSurface<File[]>) => {
      // Start outside the transition so the upload queue locks Send immediately.
      const completion = upload(files);
      startEventAction(async () => {
        await completion;
      });
    },
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

          onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
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
      rootProps: disabled
        ? {}
        : {
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
};

export const attachmentUploads = {
  controls: [
    { Component: AttachFilesControl, id: "attach-files" },
    { Component: TakePhotoControl, id: "take-photo" },
  ],
  useUploads,
} satisfies AttachmentUploadIntegration;
