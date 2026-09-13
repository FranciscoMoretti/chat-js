"use client";

import { useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { toast } from "sonner";

import { config } from "@/lib/config";
import { attachmentDigest, draftAttachment } from "@/lib/eve/draft";
import type { DraftAttachment } from "@/lib/eve/draft";
import { processFilesForUpload } from "@/lib/files/upload-prep";

export const uploadAttachment = async (file: File) => {
  const body = new FormData();
  body.append("file", file);
  const response = await fetch("/api/files/upload", {
    body,
    method: "POST",
  });
  if (!response.ok) {
    throw new Error(`Unable to upload ${file.name}.`);
  }
  const uploaded = await response.json();
  return draftAttachment.parse({
    ...uploaded,
    contentType: file.type,
    digest: await attachmentDigest(await file.arrayBuffer()),
    name: file.name,
  });
};

export const useEveAttachments = (state?: {
  attachments: DraftAttachment[];
  setAttachments: Dispatch<SetStateAction<DraftAttachment[]>>;
}) => {
  const [localAttachments, setLocalAttachments] = useState<DraftAttachment[]>(
    []
  );
  const attachments = state?.attachments ?? localAttachments;
  const setAttachments = state?.setAttachments ?? setLocalAttachments;
  const [uploadQueue, setUploadQueue] = useState<string[]>([]);
  const lock = useRef(false);
  const upload = async (files: File[]) => {
    if (lock.current || !config.features.attachments || !files.length) {
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
          // oxlint-disable-next-line eslint/no-await-in-loop -- Uploads are serialized to preserve attachment order and queue state.
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
  return { attachments, setAttachments, upload, uploadQueue };
};
