"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChatWelcomeView } from "@/components/chat/chat-welcome";
import {
  expandSelectedModelValue,
  getPrimarySelectedModelId,
  type SelectedModelValue,
  type UiToolName,
} from "@/lib/ai/types";
import { CreationRejected } from "@/lib/eve/create-conversation";
import { draftMessage, restoreDraft } from "@/lib/eve/draft";
import {
  finishCreation,
  prepareSelectedCreation,
  readCreationRequest,
} from "@/lib/eve/pending-create";
import { resolveCreationRequest } from "@/lib/eve/resolve-creation-request";
import {
  useDefaultModel,
  useModelChange,
} from "@/providers/default-model-provider";
import { EveComposer } from "./eve-composer";
import { EveCreationRecovery } from "./eve-creation-recovery";
import { useEveAttachments } from "./use-eve-attachments";

export function NewEveConversation({
  ownerId,
  projectId,
}: {
  ownerId: string;
  projectId?: string;
}) {
  const scope = useMemo(
    () => (projectId ? { projectId } : undefined),
    [projectId]
  );
  const selectedModel = useDefaultModel();
  const changeModel = useModelChange();
  const [selection, setSelection] = useState<SelectedModelValue>();
  const files = useEveAttachments();
  const { setAttachments } = files;
  const [draft, setDraft] = useState("");
  const [selectedTool, setSelectedTool] = useState<UiToolName | null>(null);
  const [projectRejected, setProjectRejected] = useState(false);
  const [retained, setRetained] = useState(false);
  const [retainedModelId, setRetainedModelId] = useState<string>();
  const [retainedModelIds, setRetainedModelIds] = useState<string[]>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  useEffect(() => {
    try {
      const pending = readCreationRequest(sessionStorage, ownerId, scope);
      if (pending) {
        setRetained(true);
        setSelectedTool(pending.selectedTool ?? null);
        const restored = restoreDraft(pending.message);
        setDraft(restored.text);
        setAttachments(restored.attachments);
        setRetainedModelIds(
          "modelIds" in pending ? pending.modelIds : undefined
        );
        setRetainedModelId("modelIds" in pending ? undefined : pending.modelId);
      }
    } catch {
      setError("The saved draft could not be restored.");
    }
  }, [ownerId, scope, setAttachments]);
  function retainOperation(
    operation: ReturnType<typeof prepareSelectedCreation>
  ) {
    setDraft(restoreDraft(operation.message).text);
    setSelectedTool(operation.selectedTool ?? null);
    setRetainedModelId("modelIds" in operation ? undefined : operation.modelId);
    setRetainedModelIds(
      "modelIds" in operation ? operation.modelIds : undefined
    );
    setRetained(true);
  }
  async function submit() {
    if (lock.current) {
      return;
    }
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const modelIds = expandSelectedModelValue(selection ?? selectedModel);
      const operation = prepareSelectedCreation(
        sessionStorage,
        ownerId,
        draftMessage(draft, files.attachments),
        modelIds,
        scope,
        selectedTool ?? undefined
      );
      retainOperation(operation);
      const id = await resolveCreationRequest(
        sessionStorage,
        ownerId,
        operation,
        scope
      );
      window.location.assign(`/chat/${id}`);
    } catch (cause) {
      if (
        cause instanceof CreationRejected &&
        cause.projectUnavailable &&
        projectId
      ) {
        setProjectRejected(true);
      } else if (cause instanceof CreationRejected) {
        finishCreation(sessionStorage, ownerId, scope);
        setRetainedModelId(undefined);
        setRetainedModelIds(undefined);
        setRetained(false);
      }
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to start. Retain this operation before retrying."
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  if (projectRejected) {
    return (
      <EveCreationRecovery
        firstMessage={draft}
        initiallyRejected
        ownerId={ownerId}
        scope={scope}
      />
    );
  }
  const composer = (
    <>
      <EveComposer
        autoFocus
        busy={busy}
        disabled={busy}
        draft={draft}
        files={files}
        modelSelection={{
          value: selection ?? selectedModel,
          onChange: async (value) => {
            setSelection(value);
            const primary = getPrimarySelectedModelId(value);
            if (primary) {
              await changeModel(primary);
            }
          },
        }}
        onDraftChange={setDraft}
        onSubmit={submit}
        onToolChange={setSelectedTool}
        readOnly={retained}
        retainedModelId={retainedModelId}
        retainedModelIds={retainedModelIds}
        selectedTool={selectedTool}
      />
      {error && <p role="alert">{error}</p>}
    </>
  );
  return projectId ? composer : <ChatWelcomeView>{composer}</ChatWelcomeView>;
}
