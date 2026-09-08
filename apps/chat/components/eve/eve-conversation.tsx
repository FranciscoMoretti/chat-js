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
  const commandLock = useRef(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [commandPending, setCommandPending] = useState(false);
  const agent = useEveAgent({
    host: "/api",
    initialSession: { sessionId, streamIndex: 0 },
    resume: true,
    onError: (cause) => {
      commandError.current = cause;
    },
    onEvent: (event) => {
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
  async function send(action: () => Promise<void>) {
    const cancellation = afterCancellation.current;
    await sendCommand(
      action,
      agent.resume,
      cancellation > 0,
      () => commandError.current
    );
    if (afterCancellation.current === cancellation) {
      afterCancellation.current = 0;
    }
  }
  let statusLabel = "Ready";
  if (busy) {
    statusLabel = "Responding…";
  }
  if (hasApproval) {
    statusLabel = "Waiting for your input";
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
            if (!(busy || hasApproval) && draft.trim()) {
              run(async () => {
                const submitted = draft;
                await send(() => agent.send(submitted.trim()));
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
              disabled={busy || commandPending || hasApproval || !draft.trim()}
              type="submit"
            >
              Send
            </Button>
            <Button
              disabled={!busy || agent.status === "resuming"}
              onClick={() => {
                agent
                  .cancel()
                  .then(() => {
                    afterCancellation.current += 1;
                  })
                  .catch(() =>
                    setError(
                      "Cancellation failed. Reconnect to check the response."
                    )
                  );
              }}
              type="button"
              variant="outline"
            >
              Stop
            </Button>
            <Button
              disabled={commandPending}
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
