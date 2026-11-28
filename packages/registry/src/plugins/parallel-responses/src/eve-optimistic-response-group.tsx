"use client";

import React from "react";
import type { JSX as ReactJSX } from "react";

import { eveResponseGroupCandidates } from "./response-group-candidates";
import { useChatModels } from "@/providers/chat-models-provider";

import type { EveResponseCardCandidate } from "./eve-response-group-cards";
import { EveResponseGroupCards } from "./eve-response-group-cards";

interface OptimisticResponseGroupOperation {
  readonly modelIds: readonly string[];
  readonly operationId: string;
}

/** A saved comparison request is visible before its native conversations exist. */
const EveOptimisticResponseGroup = ({
  operation,
}: {
  readonly operation: Readonly<OptimisticResponseGroupOperation>;
}): ReactJSX.Element => {
  const { getModelById } = useChatModels();
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
      <EveResponseGroupCards
        candidates={candidates}
        onSelect={(operationId) => {
          void operationId;
        }}
        selectedOperationId={null}
      />
    </div>
  );
};
export { EveOptimisticResponseGroup };
