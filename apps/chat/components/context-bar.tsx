"use client";

import React from "react";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { PromptInputHeader } from "@/components/ai-elements/prompt-input";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { AttachmentList } from "@/components/attachment-list";
/* oxlint-enable sort-imports */
import type { AttachmentViewData } from "@/components/attachment-list";
import { cn } from "@/lib/utils";
/* oxlint-disable no-magic-numbers, typescript/prefer-readonly-parameter-types, unicorn/no-null -- no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 0); typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including attachment: AttachmentViewData); unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

export const ContextBar = ({
  attachments,
  uploadQueue,
  onRemoveAction,
  className,
}: {
  attachments: AttachmentViewData[];
  uploadQueue: string[];
  onRemoveAction?: (attachment: AttachmentViewData) => void;
  className?: string;
}): React.JSX.Element | null => {
  const hasBarContent = attachments.length > 0 || uploadQueue.length > 0;

  if (!hasBarContent) {
    return null;
  }

  return (
    <PromptInputHeader
      // oxlint-disable-next-line react/forbid-component-props -- PromptInputHeader accepts className in its styling contract; preserve this caller's layout and appearance.
      className={cn("bg-muted w-full border-b", className)}
    >
      {(attachments.length > 0 || uploadQueue.length > 0) && (
        <AttachmentList
          attachments={attachments}
          onRemoveAction={onRemoveAction}
          testId="attachments-preview"
          uploadQueue={uploadQueue}
        />
      )}
    </PromptInputHeader>
  );
};
/* oxlint-enable no-magic-numbers, typescript/prefer-readonly-parameter-types, unicorn/no-null */
