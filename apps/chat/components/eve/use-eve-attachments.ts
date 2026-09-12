"use client";

import { type Dispatch, type SetStateAction, useRef, useState } from "react";
import { toast } from "sonner";
import { config } from "@/lib/config";
import {
  attachmentDigest,
  type DraftAttachment,
  draftAttachment,
} from "@/lib/eve/draft";
import { processFilesForUpload } from "@/lib/files/upload-prep";

export function useEveAttachments(state?: {
  attachments: DraftAttachment[];
  setAttachments: Dispatch<SetStateAction<DraftAttachment[]>>;
}) {
  const [localAttachments, setLocalAttachments] = useState<DraftAttachment[]>(
    []
  );
  const attachments = state?.attachments ?? localAttachments;
  const setAttachments = state?.setAttachments ?? setLocalAttachments;
  const [uploadQueue, setUploadQueue] = useState<string[]>([]);
  const lock = useRef(false);
  async function upload(files: File[]) {
    if (lock.current || !config.features.attachments || !files.length) {
      return;
    }
    if (files.length + attachments.length > 16) {
      toast.error("Attach at most 16 files per message.");
      return;
    }
    lock.current = true;
    setUploadQueue(files.map((file) => file.name));
    try {
      const result = await processFilesForUpload(files, config.attachments);
      if (result.stillOversized.length || result.unsupportedFiles.length) {
        toast.error(
          "Some files could not be attached. Use images or PDFs within the upload size limit."
        );
      }
      for (const file of [...result.processedImages, ...result.pdfFiles]) {
        try {
          const attachment = await uploadAttachment(file);
          setAttachments((current) => [...current, attachment]);
        } catch (cause) {
          toast.error(
            cause instanceof Error ? cause.message : "Upload failed."
          );
        }
      }
    } finally {
      lock.current = false;
      setUploadQueue([]);
    }
  }
  return { attachments, setAttachments, uploadQueue, upload };
}

export async function uploadAttachment(file: File) {
  const body = new FormData();
  body.append("file", file);
  const response = await fetch("/api/files/upload", {
    method: "POST",
    body,
  });
  if (!response.ok) {
    throw new Error(`Unable to upload ${file.name}.`);
  }
  const uploaded = await response.json();
  return draftAttachment.parse({
    ...uploaded,
    name: file.name,
    contentType: file.type,
    digest: await attachmentDigest(await file.arrayBuffer()),
  });
}
