"use client";

import { useRef, useState } from "react";
import { ChatWelcomeView } from "@/components/chat/chat-welcome";
import { ControlledChatComposer } from "@/components/chat-composer";
import { requestConversation } from "@/lib/eve/create-conversation";
import { finishCreation, prepareCreation } from "@/lib/eve/pending-create";

export function NewEveConversation({ ownerId }: { ownerId: string }) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  async function submit() {
    if (lock.current) {
      return;
    }
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const operation = prepareCreation(sessionStorage, ownerId, draft);
      setDraft(operation.message);
      const binding = await requestConversation(operation);
      finishCreation(sessionStorage, ownerId);
      window.location.assign(`/chat/${binding.id}`);
    } catch (cause) {
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
  return (
    <ChatWelcomeView>
      <ControlledChatComposer
        autoFocus
        busy={busy}
        disabled={busy}
        draft={draft}
        onDraftChange={setDraft}
        onSubmit={submit}
      />
      {error && <p role="alert">{error}</p>}
    </ChatWelcomeView>
  );
}
