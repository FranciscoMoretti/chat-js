"use client";

import { useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";

import { config } from "@/lib/config";
import type {
  AttachmentUploadIntegration,
  AttachmentUploadState,
} from "@/lib/installation-contracts";
import { useSession } from "@/providers/session-provider";

import { AttachFilesControl, TakePhotoControl } from "./controls";
import { uploadAttachment } from "./upload";
import { processFilesForUpload } from "./upload-prep";

const useUploads = ({ attachments, setAttachments }: AttachmentUploadState) => {
  const input = useRef<HTMLInputElement>(null);
  const { data: session } = useSession();
  const [uploadQueue, setUploadQueue] = useState<string[]>([]);
  const lock = useRef(false);
  const upload = async (files: File[]) => {
    if (lock.current || !files.length) {
      return;
    }
    if (!session?.user) {
      toast.error("Sign in to attach files.");
      return;
    }
    if (files.length + attachments.length > 16) {
      toast.error("Attach at most 16 files per message.");
      return;
    }
    lock.current = true;
    setUploadQueue(files.map((file) => file.name));
    // oxlint-disable-next-line react/todo -- Keep queue cleanup in finally for upload recovery.
    try {
      const result = await processFilesForUpload(files, config.attachments);
      if (result.stillOversized.length || result.unsupportedFiles.length) {
        toast.error(
          "Some files could not be attached. Use images or PDFs within the upload size limit."
        );
      }
      for (const file of [...result.processedImages, ...result.pdfFiles]) {
        try {
          // oxlint-disable-next-line eslint/no-await-in-loop -- Serialize uploads to preserve order and bound memory.
          const attachment = await uploadAttachment(file);
          setAttachments((current) => [...current, attachment]);
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
    accept: config.attachments.acceptedTypes,
    disabled: uploadQueue.length > 0,
    noClick: true,
    noKeyboard: true,
    onDrop: upload,
  });
  return {
    attachments,
    composer: (disabled: boolean) => ({
      input: (
        <input
          aria-label="Attach files"
          className="hidden"
          disabled={disabled}
          multiple
          ref={input}
          type="file"
          onChange={async (event) => {
            if (!disabled) {
              await upload([...(event.target.files ?? [])]);
            }
            event.target.value = "";
          }}
        />
      ),
      onAttach: (accept: string, capture?: "user" | "environment") => {
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
            onPasteCapture: (event: React.ClipboardEvent<HTMLDivElement>) => {
              if (event.clipboardData.files.length) {
                event.preventDefault();
                event.stopPropagation();
                upload([...event.clipboardData.files]);
              }
            },
          },
    }),
    setAttachments,
    upload,
    uploadQueue,
  };
};

export const attachmentUploadIntegration = {
  controls: [
    { Component: AttachFilesControl, id: "attach-files" },
    { Component: TakePhotoControl, id: "take-photo" },
  ],
  useUploads,
} satisfies AttachmentUploadIntegration;
