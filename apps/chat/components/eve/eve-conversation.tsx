"use client";

import { useEveAgent } from "eve/react";
import { useRef, useState } from "react";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { sendCommand } from "@/lib/eve/send-command";
import { EveMessages } from "./eve-messages";

export function EveConversation({ sessionId }: { sessionId: string }) {
  const commandError = useRef<Error | undefined>(undefined);
  const afterCancellation = useRef(0);
  const receivedMessages = useRef(0);
  const commandLock = useRef(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [commandPending, setCommandPending] = useState(false);
  const [cancelPending, setCancelPending] = useState(false);
  const agent = useEveAgent({
    host: "/api",
    initialSession: { sessionId, streamIndex: 0 },
    resume: true,
    onError: (cause) => {
      commandError.current = cause;
    },
    onEvent: (event) => {
      if (event.type === "message.received") {
        receivedMessages.current += 1;
      }
      // Eve 0.52.2 does not always promote a durable turn failure to onError.
      if (event.type === "turn.failed") {
        commandError.current = new Error(event.data.message);
      }
    },
  });
  const latestTurn = agent.events.findLast(
    (event) =>
      event.type === "turn.started" ||
      event.type === "turn.failed" ||
      event.type === "turn.completed" ||
      event.type === "turn.cancelled"
  );
  const durableError =
    latestTurn?.type === "turn.failed" ? latestTurn.data.message : undefined;
  const busy =
    agent.status === "streaming" ||
    agent.status === "submitted" ||
    agent.status === "resuming";
  const hasApproval = agent.data.messages.some((message) =>
    message.parts.some(
      (part) =>
        part.type === "dynamic-tool" && part.state === "approval-requested"
    )
  );
  async function run(action: () => Promise<unknown>) {
    if (commandLock.current) {
      return;
    }
    commandLock.current = true;
    setCommandPending(true);
    setError("");
    commandError.current = undefined;
    try {
      await action();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Request failed. Reconnect before retrying."
      );
    } finally {
      commandLock.current = false;
      setCommandPending(false);
    }
  }
  async function send(action: () => Promise<void>, isMessage = false) {
    const received = receivedMessages.current;
    const cancellation = afterCancellation.current;
    await sendCommand(
      action,
      agent.resume,
      cancellation > 0,
      () => commandError.current,
      () => !isMessage || receivedMessages.current > received
    );
    if (afterCancellation.current === cancellation) {
      afterCancellation.current = 0;
    }
  }
  async function cancel() {
    setCancelPending(true);
    afterCancellation.current += 1;
    try {
      await agent.cancel();
    } catch {
      setError("Cancellation failed. Reconnect to check the response.");
    } finally {
      setCancelPending(false);
    }
  }
  let statusLabel = "Ready";
  if (busy) {
    statusLabel = "Responding…";
  }
  if (hasApproval) {
    statusLabel = "Waiting for your input";
  }
  if (cancelPending) {
    statusLabel = "Stopping…";
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Conversation>
        <ConversationContent className="mx-auto w-full max-w-3xl">
          <EveMessages
            disabled={busy || commandPending}
            messages={agent.data.messages}
            respond={(response) =>
              run(() => send(() => agent.respond([response])))
            }
          />
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
      <div className="mx-auto w-full max-w-3xl space-y-3 p-4">
        <p aria-live="polite" className="text-muted-foreground text-sm">
          {statusLabel}
        </p>
        {(error || agent.error || durableError) && (
          <p role="alert">{error || agent.error?.message || durableError}</p>
        )}
        <form
          className="space-y-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (!(busy || hasApproval || cancelPending) && draft.trim()) {
              run(async () => {
                const submitted = draft;
                await send(() => agent.send(submitted.trim()), true);
                setDraft((current) => (current === submitted ? "" : current));
              });
            }
          }}
        >
          <label className="sr-only" htmlFor="eve-message">
            Message
          </label>
          <Textarea
            id="eve-message"
            maxLength={16_000}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Send a message…"
            value={draft}
          />
          <div className="flex gap-2">
            <Button
              disabled={
                busy ||
                commandPending ||
                cancelPending ||
                hasApproval ||
                !draft.trim()
              }
              type="submit"
            >
              Send
            </Button>
            <Button
              disabled={!busy || cancelPending || agent.status === "resuming"}
              onClick={cancel}
              type="button"
              variant="outline"
            >
              Stop
            </Button>
            <Button
              disabled={commandPending || cancelPending}
              onClick={() => run(agent.resume)}
              type="button"
              variant="ghost"
            >
              Reconnect
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
