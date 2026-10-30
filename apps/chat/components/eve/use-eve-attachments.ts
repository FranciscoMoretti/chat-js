"use client";

import { useState } from "react";
import type { Dispatch, SetStateAction } from "react";

import { attachmentUploads } from "@/integrations/uploads";
import type { DraftAttachment } from "@/lib/eve/draft";

export const useEveAttachments = (state?: {
  readonly attachments: readonly Readonly<DraftAttachment>[];
  readonly setAttachments: Dispatch<
    SetStateAction<readonly Readonly<DraftAttachment>[]>
  >;
}) => {
  const [localAttachments, setLocalAttachments] = useState<
    readonly Readonly<DraftAttachment>[]
  >([]);
  const attachments = state?.attachments ?? localAttachments;
  const setAttachments = state?.setAttachments ?? setLocalAttachments;
  const behavior = attachmentUploads.useUploads({
    attachmentCount: attachments.length,
    onUploaded: (attachment) => {
      setAttachments((current: readonly Readonly<DraftAttachment>[]) => [
        ...current,
        attachment,
      ]);
    },
  });
  return { ...behavior, attachments, setAttachments };
};
