"use client";

import React from "react";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { AttachmentList } from "@/components/attachment-list";
/* oxlint-enable sort-imports */
import { UserMessageView } from "@/components/user-message-view";
import { restoreDraft } from "@/lib/eve/draft";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { EveMessageInput } from "@/lib/eve/message-input";
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (EveInitialMessage); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable sort-imports */
/* oxlint-disable jsdoc/require-param, jsdoc/require-returns, react-perf/jsx-no-jsx-as-prop, typescript/prefer-readonly-parameter-types, unicorn/no-null -- jsdoc/require-param: the TypeScript signature describes these parameters; the prose documents behavior rather than duplicate tags; jsdoc/require-returns: the inferred or annotated return type describes the value; the prose documents behavior rather than duplicate tags; react-perf/jsx-no-jsx-as-prop: this component composition slot accepts an element from the current render; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { message, }: { message: EveMessageInput; }); unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

/** Keep the accepted first message visible until the native transcript catches up. */
export const EveInitialMessage = ({
  message,
}: {
  message: EveMessageInput;
}): React.JSX.Element => {
  const draft = restoreDraft(message);
  return (
    <UserMessageView
      actions={null}
      attachments={<AttachmentList attachments={draft.attachments} />}
      text={draft.text}
    />
  );
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable jsdoc/require-param, jsdoc/require-returns, react-perf/jsx-no-jsx-as-prop, typescript/prefer-readonly-parameter-types, unicorn/no-null */
