"use client";
/* oxlint-disable sort-imports -- Oxfmt owns this module's external, type-only, and alias import groups; its case-insensitive order conflicts with this declaration-order rule. */

import { useState } from "react";
import type { Dispatch, SetStateAction } from "react";

import { attachmentUploads } from "@/features/installed-uploads";
import type { DraftAttachment } from "@/lib/eve/draft";
/* oxlint-enable sort-imports */
/* oxlint-disable import/no-named-export, import/prefer-default-export, oxc/no-optional-chaining, oxc/no-rest-spread-properties, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types -- useEveAttachments: import/no-named-export: existing callers import this public component, type, or hook by name; import/prefer-default-export: the existing named import remains stable when this module adds another public declaration; oxc/no-optional-chaining: optional access preserves the absent prop, query result, or browser capability fallback (including state?.attachments); oxc/no-rest-spread-properties: compose immutable state or forward the remaining typed props without mutating the caller object; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including current). */

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
/* oxlint-enable import/no-named-export, import/prefer-default-export, oxc/no-optional-chaining, oxc/no-rest-spread-properties, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types */
