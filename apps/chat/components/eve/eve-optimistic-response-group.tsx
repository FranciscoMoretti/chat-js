"use client";

import { AttachmentList } from "@/components/attachment-list";
import { UserMessageView } from "@/components/user-message-view";
import { restoreDraft } from "@/lib/eve/draft";
import type { EveMessageInput } from "@/lib/eve/message-input";
import { eveResponseGroupCandidates } from "@/lib/eve/response-group-candidates";
import { useChatModels } from "@/providers/chat-models-provider";

import { EveResponseGroupCards } from "./eve-response-group-cards";
import type { EveResponseCardCandidate } from "./eve-response-group-cards";

type OptimisticResponseGroupOperation = {
  forkKind?: "comparison" | "edit";
  message: EveMessageInput;
  modelIds: string[];
  operationId: string;
};

/** Edited turns already own their inline optimistic row. */
export const shouldAppendEveOptimisticResponseGroup = (
  operation: OptimisticResponseGroupOperation
) => operation.forkKind !== "edit";

/** A saved comparison request is visible before its native conversations exist. */
export const EveOptimisticResponseGroup = ({
  operation,
}: {
  operation: OptimisticResponseGroupOperation;
}) => {
  const { getModelById } = useChatModels();
  const draft = restoreDraft(operation.message);
  const candidates: EveResponseCardCandidate[] = eveResponseGroupCandidates(
    operation.operationId,
    operation.modelIds
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
