"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  readResponseGroupDraft,
  requestResponseGroup,
  retainResponseGroupDraft,
} from "@/lib/eve/create-response-group";
import { eveResponseGroupResult } from "@/lib/eve/response-group-contracts";
import type { EveResponseGroupResult } from "@/lib/eve/response-group-contracts";
import { useChatModels } from "@/providers/chat-models-provider";
import { useModelChange } from "@/providers/default-model-provider";

import { EveArtifactLayout } from "./eve-artifact-layout";
import { EveConversation } from "./eve-conversation";
import { EveResponseGroupCards } from "./eve-response-group-cards";
import type { EveResponseCardCandidate } from "./eve-response-group-cards";

export const EveComparisonConversation = ({
  initialGroup,
  conversationId,
  ownerId,
  header,
}: {
  initialGroup: EveResponseGroupResult;
  conversationId: string;
  ownerId: string;
  header: ReactNode;
}) => {
  const { getModelById } = useChatModels();
  const router = useRouter();
  const [navigating, startNavigation] = useTransition();
  const changeModel = useModelChange();
  const [group, setGroup] = useState(initialGroup);
  const [selectedOperationId, setSelectedOperationId] = useState(
    () =>
      initialGroup.candidates.find(
        (candidate) =>
          candidate.state === "bound" &&
          candidate.conversationId === conversationId
      )?.operationId ?? null
  );
  const [status, setStatus] = useState<EveResponseCardCandidate["status"]>();
  const [busy, setBusy] = useState(false);
  const [navigationBlocked, setNavigationBlocked] = useState(true);
  const [failure, setFailure] = useState("");
  const selected = group.candidates.find(
    (candidate) => candidate.operationId === selectedOperationId
  );

  const openResponse = async (
    candidate: Extract<
      EveResponseGroupResult["candidates"][number],
      { state: "bound" }
    >
  ) => {
    const model = getModelById(candidate.modelId);
    if (model) {
      await changeModel(model.id);
    }
    if (candidate.conversationId === conversationId) {
      setSelectedOperationId(candidate.operationId);
    } else {
      startNavigation(() =>
        router.push(`/chat/${candidate.conversationId}`, { scroll: false })
      );
    }
  };

  const recover = async (dispatch: boolean) => {
    if (busy) {
      return;
    }
    setBusy(true);
    setFailure("");
    /* oxlint-disable react/todo -- Recovery must keep its busy cleanup and guarded throws. */
    try {
      let result: EveResponseGroupResult;
      if (dispatch) {
        const saved = readResponseGroupDraft(sessionStorage, ownerId, group.id);
        if (!saved) {
          // oxlint-disable-next-line react/todo -- Preserve the explicit missing-draft recovery error.
          throw new Error(
            "This tab does not have the original comparison request. Return to the tab where you sent it, or check again for its result."
          );
        }
        result = await requestResponseGroup(saved);
        retainResponseGroupDraft(sessionStorage, ownerId, saved, result);
      } else {
        const response = await fetch(`/api/agent-response-groups/${group.id}`, {
          signal: AbortSignal.timeout(15_000),
        });
        if (!response.ok) {
          // oxlint-disable-next-line react/todo -- Preserve the explicit unavailable-comparison recovery error.
          throw new Error(
            "The comparison is unavailable. Check again before retrying creation."
          );
        }
        result = eveResponseGroupResult.parse(await response.json());
      }
      setGroup(result);
      const recovered = result.candidates.find(
        (candidate) => candidate.operationId === selectedOperationId
      );
      if (recovered?.state === "bound") {
        await openResponse(recovered);
      }
    } catch (error) {
      setFailure(
        error instanceof Error
          ? error.message
          : "Unable to recover this comparison."
      );
      // oxlint-disable-next-line react/todo -- React Compiler cannot analyze required recovery cleanup in finally.
    } finally {
      setBusy(false);
    }
    /* oxlint-enable react/todo */
  };
  const cards = (
    <EveResponseGroupCards
      candidates={group.candidates.map((candidate) => ({
        ...candidate,
        disabled: busy || navigating || navigationBlocked,
        modelName: getModelById(candidate.modelId)?.name ?? candidate.modelId,
        status:
          candidate.operationId === selectedOperationId ? status : undefined,
      }))}
      onSelect={async (operationId) => {
        const candidate = group.candidates.find(
          (value) => value.operationId === operationId
        );
        if (candidate?.state === "bound") {
          setBusy(true);
          /* oxlint-disable react/todo -- Keep comparison selection cleanup in finally. */
          try {
            await openResponse(candidate);
            // oxlint-disable-next-line react/todo -- React Compiler cannot analyze required selection cleanup in finally.
          } finally {
            setBusy(false);
          }
          /* oxlint-enable react/todo */
        } else {
          setSelectedOperationId(operationId);
          setStatus(undefined);
          setFailure("");
        }
      }}
      selectedOperationId={selectedOperationId}
    />
  );
  const selectedModels: Record<string, number> = {};
  for (const candidate of group.candidates) {
    selectedModels[candidate.modelId] =
      (selectedModels[candidate.modelId] ?? 0) + 1;
  }
  if (selected?.state === "bound") {
    return (
      <EveConversation
        conversationId={selected.conversationId}
        draftScopeId={group.id}
        header={header}
        comparisonPresentation={{ cards, modelSelection: selectedModels }}
        key={selected.sessionId}
        onNavigationBlockedChange={setNavigationBlocked}
        onStatusChange={setStatus}
        ownerId={ownerId}
        sessionId={selected.sessionId}
      />
    );
  }
  return (
    <EveArtifactLayout conversationId={conversationId}>
      <section className="flex h-full min-h-0 flex-col">
        {header}
        {cards}
        <section
          aria-label="Comparison recovery"
          className="mx-auto w-full max-w-3xl space-y-4 p-4"
        >
          <output>
            {selected?.state === "rejected"
              ? selected.error
              : "This response has not been confirmed. Retry the saved request to recover the same response."}
          </output>
          {failure && <p role="alert">{failure}</p>}
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy} onClick={() => recover(true)}>
              Retry response
            </Button>
            <Button
              disabled={busy}
              onClick={() => recover(false)}
              variant="outline"
            >
              Check again
            </Button>
          </div>
        </section>
      </section>
    </EveArtifactLayout>
  );
};
