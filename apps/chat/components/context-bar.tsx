"use client";

import { InputGroupAddon } from "@/components/ui/input-group";
import { ComposerAttachments } from "./composer/composer-attachments";

import { AttachmentList } from "@/components/attachment-list";

import type { AttachmentViewData } from "@/components/attachment-list";

import React from "react";

export const ContextBar = ({
  attachments,
  uploadQueue,
  onRemoveAction,
  className,
}: {
  readonly attachments: readonly AttachmentViewData[];
  readonly uploadQueue: readonly string[];
  readonly onRemoveAction?: (attachment: AttachmentViewData) => void;
  readonly className?: string;
}): React.JSX.Element | null => {
  const hasBarContent = attachments.length > 0 || uploadQueue.length > 0;

  if (!hasBarContent) {
    return null;
  }

  return (
    <ComposerAttachments className={className} primitives={{ InputGroupAddon }}>
      <AttachmentList
        attachments={attachments}
        onRemoveAction={onRemoveAction}
        testId="attachments-preview"
        uploadQueue={uploadQueue}
      />
    </ComposerAttachments>
  );
};
