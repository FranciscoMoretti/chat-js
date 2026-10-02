"use client";
import { useState } from "react";
import type { Dispatch, SetStateAction } from "react";

import { attachmentUploads } from "@/features/installed-uploads";
import type { DraftAttachment } from "@/lib/eve/draft";

export const useEveAttachments = (state?: {
  attachments: DraftAttachment[];
  setAttachments: Dispatch<SetStateAction<DraftAttachment[]>>;
}) => {
  const [localAttachments, setLocalAttachments] = useState<DraftAttachment[]>(
    []
  );
  const attachments = state?.attachments ?? localAttachments;
  const setAttachments = state?.setAttachments ?? setLocalAttachments;
  return attachmentUploads.useUploads({ attachments, setAttachments });
};
