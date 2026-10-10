"use client";

import { PromptInputHeader } from "@/components/ai-elements/prompt-input";

/* oxlint-disable sort-imports -- The combined development and production module-effect trace rejects swapping @/components/ai-elements/prompt-input and @/components/attachment-list; keep this adjacent import pair ordered. */
import { AttachmentList } from "@/components/attachment-list";
/* oxlint-enable sort-imports */

import type { AttachmentViewData } from "@/components/attachment-list";

import React from "react";
import { cn } from "@/lib/utils";
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (ContextBar); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable no-magic-numbers, unicorn/no-null -- no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 0); unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

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
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable no-magic-numbers, unicorn/no-null */
