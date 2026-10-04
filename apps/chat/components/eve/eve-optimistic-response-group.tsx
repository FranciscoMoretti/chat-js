"use client";

import React from "react";

import { AttachmentList } from "@/components/attachment-list";
import { UserMessageView } from "@/components/user-message-view";
import { restoreDraft } from "@/lib/eve/draft";
import type { EveMessageInput } from "@/lib/eve/message-input";
import { eveResponseGroupCandidates } from "@/lib/eve/response-group-candidates";
import { useChatModels } from "@/providers/chat-models-provider";

import { EveResponseGroupCards } from "./eve-response-group-cards";
import type { EveResponseCardCandidate } from "./eve-response-group-cards";

interface OptimisticResponseGroupOperation {
  forkKind?: "comparison" | "edit";
  message: EveMessageInput;
  modelIds: string[];
  operationId: string;
}
/* oxlint-disable jsdoc/require-param, jsdoc/require-returns, typescript/prefer-readonly-parameter-types -- shouldAppendEveOptimisticResponseGroup: jsdoc/require-param: the TypeScript signature describes these parameters; the prose documents behavior rather than duplicate tags; jsdoc/require-returns: the inferred or annotated return type describes the value; the prose documents behavior rather than duplicate tags; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including operation: OptimisticResponseGroupOperation). */

/** Edited turns already own their inline optimistic row. */
const shouldAppendEveOptimisticResponseGroup = (
  operation: OptimisticResponseGroupOperation
): boolean => operation.forkKind !== "edit";
/* oxlint-enable jsdoc/require-param, jsdoc/require-returns, typescript/prefer-readonly-parameter-types */

/* oxlint-disable jsdoc/require-param, jsdoc/require-returns, react-perf/jsx-no-jsx-as-prop, react-perf/jsx-no-new-array-as-prop, react-perf/jsx-no-new-function-as-prop, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, unicorn/no-null -- EveOptimisticResponseGroup: jsdoc/require-param: the TypeScript signature describes these parameters; the prose documents behavior rather than duplicate tags; jsdoc/require-returns: the inferred or annotated return type describes the value; the prose documents behavior rather than duplicate tags; react-perf/jsx-no-jsx-as-prop: this component composition slot accepts an element from the current render; react-perf/jsx-no-new-array-as-prop: these props derive from the current render; sharing or memoizing them requires a separate identity contract; react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including candidate); unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

/** A saved comparison request is visible before its native conversations exist. */
const EveOptimisticResponseGroup = ({
  operation,
}: {
  operation: OptimisticResponseGroupOperation;
}) => {
  const { getModelById } = useChatModels();
  const draft = restoreDraft(operation.message);
  const candidates: EveResponseCardCandidate[] = eveResponseGroupCandidates(
    operation.operationId,
    operation.modelIds
    // oxlint-disable-next-line oxc/no-map-spread -- #541: Disable the optimistic view without mutating the shared logical candidate records.
  ).map((candidate) => ({
    ...candidate,
    disabled: true,
    modelName: getModelById(candidate.modelId)?.name ?? candidate.modelId,
    state: "pending",
  }));

  return (
    <div data-testid="optimistic-response-group">
      <UserMessageView
        actions={null}
        attachments={<AttachmentList attachments={draft.attachments} />}
        responses={
          <EveResponseGroupCards
            candidates={candidates}
            onSelect={(operationId) => {
              void operationId;
            }}
            selectedOperationId={null}
          />
        }
        text={draft.text}
      />
    </div>
  );
};
/* oxlint-enable jsdoc/require-param, jsdoc/require-returns, react-perf/jsx-no-jsx-as-prop, react-perf/jsx-no-new-array-as-prop, react-perf/jsx-no-new-function-as-prop, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, unicorn/no-null */
/* oxlint-disable react/only-export-components -- #620: Consumers import EveOptimisticResponseGroup, shouldAppendEveOptimisticResponseGroup from this existing mixed component, context, or helper API; separating the Fast Refresh boundary remains tracked review debt. */
export { EveOptimisticResponseGroup, shouldAppendEveOptimisticResponseGroup };
/* oxlint-enable react/only-export-components */
