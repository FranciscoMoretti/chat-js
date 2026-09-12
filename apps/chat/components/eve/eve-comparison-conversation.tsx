"use client";

import { type ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  readResponseGroupDraft,
  requestResponseGroup,
  retainResponseGroupDraft,
} from "@/lib/eve/create-response-group";
import {
  type EveResponseGroupResult,
  eveResponseGroupResult,
} from "@/lib/eve/response-group-contracts";
import { useChatModels } from "@/providers/chat-models-provider";
import { useModelChange } from "@/providers/default-model-provider";
import { EveArtifactLayout } from "./eve-artifact-layout";
import { EveConversation } from "./eve-conversation";
import {
  type EveResponseCardCandidate,
  EveResponseGroupCards,
} from "./eve-response-group-cards";

export function EveComparisonConversation({
  initialGroup,
  conversationId,
  ownerId,
  header,
}: {
  initialGroup: EveResponseGroupResult;
  conversationId: string;
  ownerId: string;
  header: ReactNode;
}) {
  const { getModelById } = useChatModels();
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
  const [error, setError] = useState("");
  const selected = group.candidates.find(
    (candidate) => candidate.operationId === selectedOperationId
  );

  async function openResponse(
    candidate: Extract<
      EveResponseGroupResult["candidates"][number],
      { state: "bound" }
    >
  ) {
    const model = getModelById(candidate.modelId);
    if (model) {
      await changeModel(model.id);
    }
    if (candidate.conversationId === conversationId) {
      setSelectedOperationId(candidate.operationId);
    } else {
      window.location.assign(`/chat/${candidate.conversationId}`);
    }
  }

  async function recover(dispatch: boolean) {
    if (busy) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      let result: EveResponseGroupResult;
      if (dispatch) {
        const saved = readResponseGroupDraft(sessionStorage, ownerId, group.id);
        if (!saved) {
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
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to recover this comparison."
      );
    } finally {
      setBusy(false);
    }
  }
  const cards = (
    <div className="mx-auto w-full max-w-3xl px-4 pb-2">
      <EveResponseGroupCards
        candidates={group.candidates.map((candidate) => ({
          ...candidate,
          modelName: getModelById(candidate.modelId)?.name ?? candidate.modelId,
          disabled: busy || navigationBlocked,
          status:
            candidate.operationId === selectedOperationId ? status : undefined,
        }))}
        onSelect={async (operationId) => {
          const candidate = group.candidates.find(
            (value) => value.operationId === operationId
          );
          if (candidate?.state === "bound") {
            setBusy(true);
            try {
              await openResponse(candidate);
            } finally {
              setBusy(false);
            }
          } else {
            setSelectedOperationId(operationId);
            setStatus(undefined);
            setError("");
          }
        }}
        selectedOperationId={selectedOperationId}
      />
    </div>
  );
  if (selected?.state === "bound") {
    return (
      <EveConversation
        conversationId={selected.conversationId}
        draftScopeId={group.id}
        header={
          <>
            {header}
            {cards}
          </>
        }
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
          <p role="status">
            {selected?.state === "rejected"
              ? selected.error
              : "This response has not been confirmed. Retry the saved request to recover the same response."}
          </p>
          {error && <p role="alert">{error}</p>}
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
}
