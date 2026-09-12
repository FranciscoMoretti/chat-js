"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChatWelcomeView } from "@/components/chat/chat-welcome";
import {
  CreationRejected,
  requestConversation,
} from "@/lib/eve/create-conversation";
import { draftMessage } from "@/lib/eve/draft";
import {
  finishCreation,
  prepareCreation,
  readCreation,
} from "@/lib/eve/pending-create";
import { useDefaultModel } from "@/providers/default-model-provider";
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
  const files = useEveAttachments();
  const { setAttachments } = files;
  const [draft, setDraft] = useState("");
  const [projectRejected, setProjectRejected] = useState(false);
  const [retained, setRetained] = useState(false);
  const [retainedModelId, setRetainedModelId] = useState<string>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  useEffect(() => {
    try {
      const pending = readCreation(sessionStorage, ownerId, scope);
      if (pending) {
        setRetained(true);
        setDraft(
          typeof pending.message === "string"
            ? pending.message
            : (pending.message.find((part) => part.type === "text")?.text ?? "")
        );
        setAttachments(
          typeof pending.message === "string"
            ? []
            : pending.message
                .filter((part) => part.type === "file")
                .map((part) => ({
                  url: part.data,
                  name: part.filename,
                  contentType: part.mediaType,
                  digest: "",
                }))
        );
        setRetainedModelId(pending.modelId);
      }
    } catch {
      setError("The saved draft could not be restored.");
    }
  }, [ownerId, scope, setAttachments]);
  async function submit() {
    if (lock.current) {
      return;
    }
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const operation = prepareCreation(
        sessionStorage,
        ownerId,
        draftMessage(draft, files.attachments),
        selectedModel,
        scope
      );
      setDraft(
        typeof operation.message === "string"
          ? operation.message
          : (operation.message.find((part) => part.type === "text")?.text ?? "")
      );
      setRetainedModelId(operation.modelId);
      setRetained(true);
      const binding = await requestConversation(operation);
      finishCreation(sessionStorage, ownerId, scope);
      window.location.assign(`/chat/${binding.id}`);
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
        onDraftChange={setDraft}
        onSubmit={submit}
        readOnly={retained}
        retainedModelId={retainedModelId}
      />
      {error && <p role="alert">{error}</p>}
    </>
  );
  return projectId ? composer : <ChatWelcomeView>{composer}</ChatWelcomeView>;
}
