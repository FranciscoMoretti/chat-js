"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { requestConversation } from "@/lib/eve/create-conversation";
import {
  type CreationScope,
  finishCreation,
  readCreation,
} from "@/lib/eve/pending-create";

export function EveCreationRecovery({
  ownerId,
  operationId,
  firstMessage,
  scope,
}: {
  ownerId: string;
  operationId: string;
  firstMessage: string;
  scope?: CreationScope;
}) {
  const router = useRouter();
  const lock = useRef(false);
  const [pending, setPending] = useState<ReturnType<typeof readCreation>>();
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    try {
      const saved = readCreation(sessionStorage, ownerId, scope);
      setPending(saved?.operationId === operationId ? saved : undefined);
    } catch {
      setError("The saved request could not be restored.");
    }
    setLoaded(true);
  }, [ownerId, operationId, scope]);

  async function retry() {
    if (!pending || lock.current) {
      return;
    }
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const binding = await requestConversation(pending);
      if (
        readCreation(sessionStorage, ownerId, scope)?.operationId ===
        operationId
      ) {
        finishCreation(sessionStorage, ownerId, scope);
      }
      window.location.assign(`/chat/${binding.id}`);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to recover. Try again."
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  let status = "Checking the saved request…";
  if (loaded) {
    status = pending
      ? "Conversation creation is unconfirmed. Retry the saved request to recover it."
      : "This browser does not have the original request. Return to the tab where you sent it, or check again if creation is still running.";
  }
  return (
    <section aria-label="Conversation recovery" className="space-y-4 p-4">
      <p className="whitespace-pre-wrap break-words">{firstMessage}</p>
      <p role="status">{status}</p>
      {error && <p role="alert">{error}</p>}
      {pending ? (
        <Button disabled={busy} onClick={retry}>
          {busy ? "Recovering…" : "Retry creation"}
        </Button>
      ) : (
        <Button
          disabled={!loaded}
          onClick={() => router.refresh()}
          variant="outline"
        >
          Check again
        </Button>
      )}
    </section>
  );
}
