"use client";

import React from "react";
import type { JSX as ReactJSX } from "react";

/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import { AttachmentList } from "@/components/attachment-list";
/* oxlint-enable sort-imports */
import { UserMessageView } from "@/components/user-message-view";
import { restoreDraft } from "@/lib/eve/draft";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { ReadonlyEveMessageInput } from "@/lib/eve/readonly-message-types";
/* oxlint-enable sort-imports */
import { eveResponseGroupCandidates } from "@/lib/eve/response-group-candidates";
import { useChatModels } from "@/providers/chat-models-provider";

/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { EveResponseCardCandidate } from "./eve-response-group-cards";
/* oxlint-enable sort-imports */
import { EveResponseGroupCards } from "./eve-response-group-cards";

interface OptimisticResponseGroupOperation {
  readonly forkKind?: "comparison" | "edit";
  readonly message: ReadonlyEveMessageInput;
  readonly modelIds: readonly string[];
  readonly operationId: string;
}
/* oxlint-disable jsdoc/require-param, jsdoc/require-returns -- shouldAppendEveOptimisticResponseGroup: jsdoc/require-param: the TypeScript signature describes these parameters; the prose documents behavior rather than duplicate tags; jsdoc/require-returns: the inferred or annotated return type describes the value; the prose documents behavior rather than duplicate tags */

/** Edited turns already own their inline optimistic row. */
const shouldAppendEveOptimisticResponseGroup = (
  operation: Readonly<OptimisticResponseGroupOperation>
): boolean => operation.forkKind !== "edit";
/* oxlint-enable jsdoc/require-param, jsdoc/require-returns */

/* oxlint-disable jsdoc/require-param, jsdoc/require-returns, react-perf/jsx-no-jsx-as-prop, react-perf/jsx-no-new-array-as-prop, react-perf/jsx-no-new-function-as-prop, unicorn/no-null -- EveOptimisticResponseGroup: jsdoc/require-param: the TypeScript signature describes these parameters; the prose documents behavior rather than duplicate tags; jsdoc/require-returns: the inferred or annotated return type describes the value; the prose documents behavior rather than duplicate tags; react-perf/jsx-no-jsx-as-prop: this component composition slot accepts an element from the current render; react-perf/jsx-no-new-array-as-prop: these props derive from the current render; sharing or memoizing them requires a separate identity contract; react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

/** A saved comparison request is visible before its native conversations exist. */
const EveOptimisticResponseGroup = ({
  operation,
}: {
  readonly operation: Readonly<
    Pick<
      OptimisticResponseGroupOperation,
      "message" | "operationId" | "modelIds"
    >
  >;
}): ReactJSX.Element => {
  const { getModelById } = useChatModels();
  const draft = restoreDraft(operation.message);
  const candidates: EveResponseCardCandidate[] = eveResponseGroupCandidates(
    operation.operationId,
    operation.modelIds
    // oxlint-disable-next-line oxc/no-map-spread -- #541: Disable the optimistic view without mutating the shared logical candidate records.
  ).map((candidate: Readonly<{ modelId: string; operationId: string }>) => ({
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing candidate own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    ...candidate,
    disabled: true,
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading name from getModelById(...); preserve one receiver evaluation, skipped accesses and the existing candidate.modelId fallback. The app guidance prefers optional chaining.
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
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (EveOptimisticResponseGroup, shouldAppendEveOptimisticResponseGroup); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable jsdoc/require-param, jsdoc/require-returns, react-perf/jsx-no-jsx-as-prop, react-perf/jsx-no-new-array-as-prop, react-perf/jsx-no-new-function-as-prop, unicorn/no-null */
/* oxlint-disable react/only-export-components -- #620: Consumers import EveOptimisticResponseGroup, shouldAppendEveOptimisticResponseGroup from this existing mixed component, context, or helper API; separating the Fast Refresh boundary remains tracked review debt. */
export { EveOptimisticResponseGroup, shouldAppendEveOptimisticResponseGroup };
/* oxlint-enable import/no-named-export */
/* oxlint-enable react/only-export-components */
