"use client";

import React from "react";
import type { JSX as ReactJSX } from "react";

import { AttachmentList } from "@/components/attachment-list";
import { UserMessageView } from "@/components/user-message-view";
import { restoreDraft } from "@/lib/eve/draft";
import type { ReadonlyEveMessageInput } from "@/lib/eve/readonly-message-types";
import { eveResponseGroupCandidates } from "@/lib/eve/response-group-candidates";
import { useChatModels } from "@/providers/chat-models-provider";

import type { EveResponseCardCandidate } from "./eve-response-group-cards";
import { EveResponseGroupCards } from "./eve-response-group-cards";

interface OptimisticResponseGroupOperation {
  readonly forkKind?: "comparison" | "edit";
  readonly message: ReadonlyEveMessageInput;
  readonly modelIds: readonly string[];
  readonly operationId: string;
}

/** Edited turns already own their inline optimistic row. */
const shouldAppendEveOptimisticResponseGroup = (
  operation: Readonly<OptimisticResponseGroupOperation>
): boolean => operation.forkKind !== "edit";

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
  ).map((candidate: Readonly<{ modelId: string; operationId: string }>) => ({
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
export { EveOptimisticResponseGroup, shouldAppendEveOptimisticResponseGroup };
