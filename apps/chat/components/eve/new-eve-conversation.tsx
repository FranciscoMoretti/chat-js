"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  Conversation,
  ConversationContent,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent } from "@/components/ai-elements/message";
import { AttachmentList } from "@/components/attachment-list";
import { ChatWelcomeView } from "@/components/chat/chat-welcome";
import {
  expandSelectedModelValue,
  getPrimarySelectedModelId,
} from "@/lib/ai/types";
import type { SelectedModelValue, UiToolName } from "@/lib/ai/types";
import { CreationRejectedError } from "@/lib/eve/create-conversation";
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
import { EveOptimisticResponseGroup } from "./eve-optimistic-response-group";
import { useEveAttachments } from "./use-eve-attachments";

export const NewEveConversation = ({
  ownerId,
  projectId,
}: {
  ownerId: string;
  projectId?: string;
}) => {
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
  const [failure, setFailure] = useState("");
  const [busy, setBusy] = useState(false);
  const [optimisticComparison, setOptimisticComparison] =
    useState<
      Extract<
        ReturnType<typeof prepareSelectedCreation>,
        { modelIds: string[] }
      >
    >();
  const lock = useRef(false);
  useEffect(() => {
    try {
      const pending = readCreationRequest(sessionStorage, ownerId, scope);
      if (pending) {
        // oxlint-disable-next-line react/set-state-in-effect -- Hydrate the recovery composer from its durable request.
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
      setFailure("The saved draft could not be restored.");
    }
  }, [ownerId, scope, setAttachments]);
  const retainOperation = (
    operation: ReturnType<typeof prepareSelectedCreation>
  ) => {
    setDraft(restoreDraft(operation.message).text);
    setSelectedTool(operation.selectedTool ?? null);
    setRetainedModelId("modelIds" in operation ? undefined : operation.modelId);
    setRetainedModelIds(
      "modelIds" in operation ? operation.modelIds : undefined
    );
    setOptimisticComparison("modelIds" in operation ? operation : undefined);
    setRetained(true);
  };
  const submit = async () => {
    if (lock.current) {
      return;
    }
    lock.current = true;
    setBusy(true);
    setFailure("");
    let navigating = false;
    /* oxlint-disable react/todo -- Preserve operation lock cleanup across navigation and errors. */
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
      navigating = true;
    } catch (error) {
      if (
        error instanceof CreationRejectedError &&
        error.projectUnavailable &&
        projectId
      ) {
        setProjectRejected(true);
      } else if (error instanceof CreationRejectedError) {
        finishCreation(sessionStorage, ownerId, scope);
        setRetainedModelId(undefined);
        setRetainedModelIds(undefined);
        setOptimisticComparison(undefined);
        setRetained(false);
      }
      setFailure(
        error instanceof Error
          ? error.message
          : "Unable to start. Retain this operation before retrying."
      );
      // oxlint-disable-next-line react/todo -- React Compiler cannot analyze required operation lock cleanup in finally.
    } finally {
      lock.current = false;
      if (!navigating) {
        setBusy(false);
      }
    }
    /* oxlint-enable react/todo */
  };
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
        draft={busy ? "" : draft}
        files={busy ? { ...files, attachments: [] } : files}
        modelSelection={{
          onChange: async (value) => {
            setSelection(value);
            const primary = getPrimarySelectedModelId(value);
            if (primary) {
              await changeModel(primary);
            }
          },
          value: selection ?? selectedModel,
        }}
        onDraftChange={(value) => {
          // Clearing the controlled editor must not erase the saved send intent.
          if (!busy) {
            setDraft(value);
          }
        }}
        onSubmit={submit}
        onToolChange={setSelectedTool}
        readOnly={retained}
        retainedModelId={retainedModelId}
        retainedModelIds={retainedModelIds}
        selectedTool={selectedTool}
      />
      {failure && <p role="alert">{failure}</p>}
    </>
  );
  if (busy) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <Conversation>
          <ConversationContent className="mx-auto w-full max-w-3xl">
            {optimisticComparison ? (
              <EveOptimisticResponseGroup operation={optimisticComparison} />
            ) : (
              <Message className="flex-col" from="user">
                <MessageContent className="max-w-full min-w-0">
                  <span className="sr-only">You</span>
                  <p className="whitespace-pre-wrap">{draft}</p>
                  <AttachmentList attachments={files.attachments} />
                </MessageContent>
              </Message>
            )}
            <output className="sr-only">Sending…</output>
          </ConversationContent>
        </Conversation>
        <div className="mx-auto w-full max-w-3xl p-4">{composer}</div>
      </div>
    );
  }
  return projectId ? composer : <ChatWelcomeView>{composer}</ChatWelcomeView>;
};
