"use client";

import { InputGroupAddon } from "@/components/ui/input-group";

import { AttachmentList } from "@/components/attachment-list";

import type { AttachmentViewData } from "@/components/attachment-list";

import React from "react";
import { cn } from "@/lib/utils";

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
    <InputGroupAddon
      align="block-start"
      className={cn("flex-wrap border-b", className)}
    >
      {(attachments.length > 0 || uploadQueue.length > 0) && (
        <AttachmentList
          attachments={attachments}
          onRemoveAction={onRemoveAction}
          testId="attachments-preview"
          uploadQueue={uploadQueue}
        />
      )}
    </InputGroupAddon>
  );
};
