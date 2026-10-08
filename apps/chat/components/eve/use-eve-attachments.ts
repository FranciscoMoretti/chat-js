"use client";

import { useState } from "react";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { Dispatch, SetStateAction } from "react";
/* oxlint-enable sort-imports */

import { attachmentUploads } from "@/features/installed-uploads";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { DraftAttachment } from "@/lib/eve/draft";
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (useEveAttachments); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable sort-imports */
/* oxlint-disable typescript/explicit-function-return-type, typescript/explicit-module-boundary-types -- useEveAttachments: ; ; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships */

export const useEveAttachments = (state?: {
  readonly attachments: readonly Readonly<DraftAttachment>[];
  readonly setAttachments: Dispatch<
    SetStateAction<readonly Readonly<DraftAttachment>[]>
  >;
}) => {
  const [localAttachments, setLocalAttachments] = useState<
    readonly Readonly<DraftAttachment>[]
  >([]);
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading attachments from state; preserve one receiver evaluation, skipped accesses and the existing localAttachments fallback. The app guidance prefers optional chaining.
  const attachments = state?.attachments ?? localAttachments;
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading setAttachments from state; preserve one receiver evaluation, skipped accesses and the existing setLocalAttachments fallback. The app guidance prefers optional chaining.
  const setAttachments = state?.setAttachments ?? setLocalAttachments;
  const behavior = attachmentUploads.useUploads({
    attachmentCount: attachments.length,
    onUploaded: (attachment) =>
      setAttachments((current: readonly Readonly<DraftAttachment>[]) => [
        ...current,
        attachment,
      ]),
  });
  // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing behavior own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
  return { ...behavior, attachments, setAttachments };
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable typescript/explicit-function-return-type, typescript/explicit-module-boundary-types */
