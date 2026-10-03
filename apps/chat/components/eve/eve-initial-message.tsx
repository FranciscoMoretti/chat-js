"use client";

import React from "react";

import { AttachmentList } from "@/components/attachment-list";
import { UserMessageView } from "@/components/user-message-view";
import { restoreDraft } from "@/lib/eve/draft";
import type { EveMessageInput } from "@/lib/eve/message-input";
/* oxlint-disable jsdoc/require-param, jsdoc/require-returns, react-perf/jsx-no-jsx-as-prop, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, unicorn/no-null -- EveInitialMessage: ; jsdoc/require-param: the TypeScript signature describes these parameters; the prose documents behavior rather than duplicate tags; jsdoc/require-returns: the inferred or annotated return type describes the value; the prose documents behavior rather than duplicate tags; react-perf/jsx-no-jsx-as-prop: this component composition slot accepts an element from the current render; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { message, }: { message: EveMessageInput; }); unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

/** Keep the accepted first message visible until the native transcript catches up. */
export const EveInitialMessage = ({
  message,
}: {
  message: EveMessageInput;
}) => {
  const draft = restoreDraft(message);
  return (
    <UserMessageView
      actions={null}
      attachments={<AttachmentList attachments={draft.attachments} />}
      text={draft.text}
    />
  );
};
/* oxlint-enable jsdoc/require-param, jsdoc/require-returns, react-perf/jsx-no-jsx-as-prop, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, unicorn/no-null */
