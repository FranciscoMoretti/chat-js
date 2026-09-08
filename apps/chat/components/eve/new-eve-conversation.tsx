"use client";

import { useRef, useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { conversationBinding } from "@/lib/eve/contracts";
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
      const response = await fetch("/api/agent-conversations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(operation),
      });
      const body: unknown = await response.json();
      if (!response.ok) {
        throw new Error(z.object({ error: z.string() }).parse(body).error);
      }
      const binding = conversationBinding.parse(body);
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
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-5 p-4">
      <h2 className="text-2xl">How can I help you today?</h2>
      <p className="text-muted-foreground">
        Ask a question or describe what you need help with.
      </p>
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <label className="sr-only" htmlFor="eve-first-message">
          Message
        </label>
        <Textarea
          disabled={busy}
          id="eve-first-message"
          maxLength={16_000}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Send a message…"
          value={draft}
        />
        <Button disabled={busy || !draft.trim()} type="submit">
          {busy ? "Starting…" : "Send"}
        </Button>
      </form>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
