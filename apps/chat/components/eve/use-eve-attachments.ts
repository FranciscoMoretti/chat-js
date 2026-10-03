"use client";

import { useState } from "react";
import type { Dispatch, SetStateAction } from "react";

import { attachmentUploads } from "@/features/installed-uploads";
import type { DraftAttachment } from "@/lib/eve/draft";
/* oxlint-disable typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types -- useEveAttachments: ; ; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including current). */

export const useEveAttachments = (state?: {
  attachments: DraftAttachment[];
  setAttachments: Dispatch<SetStateAction<DraftAttachment[]>>;
}) => {
  const [localAttachments, setLocalAttachments] = useState<DraftAttachment[]>(
    []
  );
  const attachments = state?.attachments ?? localAttachments;
  const setAttachments = state?.setAttachments ?? setLocalAttachments;
  const behavior = attachmentUploads.useUploads({
    attachmentCount: attachments.length,
    onUploaded: (attachment) =>
      setAttachments((current) => [...current, attachment]),
  });
  return { ...behavior, attachments, setAttachments };
};
/* oxlint-enable typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types */
