"use client";

import type {
  AttachmentUploadBehavior,
  AttachmentUploadInput,
  AttachmentUploadIntegration,
} from "@/lib/installation-contracts";

import { useEffect, useRef, useState } from "react";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";

import { config } from "@/lib/config";
import { useSession } from "@/providers/session-provider";

import { uploadAttachment } from "./upload";
import { processFilesForUpload } from "./upload-prep";

const deliverFiles = async (
  files: readonly File[],
  onUploaded: AttachmentUploadInput["onUploaded"],
  reportError: (message: string) => void
): Promise<void> => {
  try {
    const result = await processFilesForUpload([...files], config.attachments);
    if (
      result.stillOversized.length > 0 ||
      result.unsupportedFiles.length > 0
    ) {
      reportError(
        "Some files could not be attached. Use images or PDFs within the upload size limit."
      );
    }
    for (const file of result.files) {
      try {
        // oxlint-disable-next-line eslint/no-await-in-loop -- Serialize uploads to preserve order and bound memory.
        const attachment = await uploadAttachment(file);
        onUploaded(attachment);
      } catch (error) {
        reportError(error instanceof Error ? error.message : "Upload failed.");
      }
    }
  } catch (error) {
    reportError(error instanceof Error ? error.message : "Upload failed.");
  }
};

export const useAttachmentUploads = ({
  onError,
  attachmentCount,
  onUploaded,
}: ReadonlyNativeSurface<AttachmentUploadInput>): AttachmentUploadBehavior => {
  const { data: session } = useSession();
  const [uploadQueue, setUploadQueue] = useState<string[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const reportError = (message: string): void => {
    setErrors((current) => [...current, message]);
    onError?.(message);
  };
  const lock = useRef(false);
  const currentCount = useRef(attachmentCount);
  useEffect((): void => {
    currentCount.current = attachmentCount;
  }, [attachmentCount]);
  const enqueue = async (files: readonly File[]): Promise<void> => {
    if (lock.current || files.length === 0) {
      return;
    }
    setErrors([]);
    if (!session?.user) {
      reportError("Sign in to attach files.");
      return;
    }
    if (files.length + currentCount.current > 16) {
      reportError("Attach at most 16 files per message.");
      return;
    }
    lock.current = true;
    setUploadQueue(
      files.map((file: ReadonlyNativeSurface<File>): string => file.name)
    );
    await deliverFiles(
      files,
      (attachment) => {
        currentCount.current += 1;
        onUploaded(attachment);
      },
      reportError
    ).finally(() => {
      lock.current = false;
      setUploadQueue([]);
    });
  };
  return {
    enabled: true,
    busy: uploadQueue.length > 0,
    uploadQueue,
    errors,
    enqueue,
  };
};

export const attachmentUploads = {
  useUploads: useAttachmentUploads,
} satisfies AttachmentUploadIntegration;
