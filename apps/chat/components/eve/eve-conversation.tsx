"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEveAgent } from "eve/react";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { ControlledChatComposer } from "@/components/chat-composer";
import { Button } from "@/components/ui/button";
import { sendCommand } from "@/lib/eve/send-command";
import { useDefaultModel } from "@/providers/default-model-provider";
import { useTRPC } from "@/trpc/react";
import { EveMessages } from "./eve-messages";
import { EveModelPicker } from "./eve-model-picker";

const pendingMessageSchema = z.object({
  message: z.string(),
  afterSequence: z.number(),
  checkUntil: z.number(),
});

export function EveConversation({ sessionId }: { sessionId: string }) {
  const selectedModel = useDefaultModel();
  const queryClient = useQueryClient();
  const trpc = useTRPC();
  const storageKey = `chatjs.eve.pending-message:${sessionId}`;
  const [pendingMessage, setPendingMessage] = useState<z.infer<
    typeof pendingMessageSchema
  > | null>(null);
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
      if (event.type === "turn.completed") {
        queryClient
          .invalidateQueries({ queryKey: trpc.eve.list.queryKey() })
          .catch(() => undefined);
      }
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
  useEffect(() => {
    const stored = sessionStorage.getItem(storageKey);
    if (!stored) {
      return;
    }
    try {
      const pending = pendingMessageSchema.safeParse(JSON.parse(stored));
      if (pending.success) {
        setPendingMessage(pending.data);
      }
    } catch {
      sessionStorage.removeItem(storageKey);
    }
  }, [storageKey]);
  useEffect(() => {
    if (!pendingMessage) {
      return;
    }
    const accepted = agent.events.some(
      (event) =>
        event.type === "message.received" &&
        event.data.sequence > pendingMessage.afterSequence &&
        event.data.message === pendingMessage.message
    );
    if (accepted) {
      sessionStorage.removeItem(storageKey);
      setPendingMessage(null);
      return;
    }
    // A replay can reach the previous turn's boundary before a pending POST
    // is accepted. Check the native log again; never resend the input.
    if (busy || commandPending || Date.now() >= pendingMessage.checkUntil) {
      return;
    }
    const timer = setTimeout(() => {
      agent.resume().catch(() => undefined);
    }, 2000);
    return () => clearTimeout(timer);
  }, [
    agent.events,
    agent.resume,
    busy,
    commandPending,
    pendingMessage,
    storageKey,
  ]);
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
  if (agent.status === "resuming") {
    statusLabel = "Restoring conversation…";
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
        {pendingMessage && !commandPending && (
          <div className="space-y-2 text-sm" role="status">
            <p>
              Message delivery is unconfirmed. Your text is saved in this tab.
            </p>
            <p className="whitespace-pre-wrap">{pendingMessage.message}</p>
            <Button
              onClick={() => {
                setDraft((current) =>
                  current
                    ? `${current}\n\n${pendingMessage.message}`
                    : pendingMessage.message
                );
                sessionStorage.removeItem(storageKey);
                setPendingMessage(null);
                setError(
                  "Delivery is unconfirmed. Check the conversation before sending this message again."
                );
              }}
              size="sm"
              type="button"
              variant="ghost"
            >
              Restore draft
            </Button>
          </div>
        )}
        <ControlledChatComposer
          busy={busy}
          disabled={
            busy ||
            commandPending ||
            cancelPending ||
            hasApproval ||
            !!pendingMessage
          }
          draft={draft}
          onDraftChange={setDraft}
          onStop={cancel}
          onSubmit={() =>
            run(async () => {
              const submitted = draft;
              const pending = {
                message: submitted.trim(),
                checkUntil: Date.now() + 60_000,
                afterSequence: Math.max(
                  -1,
                  ...agent.events.flatMap((event) =>
                    event.type === "message.received"
                      ? [event.data.sequence]
                      : []
                  )
                ),
              };
              // Save before clearing: a reload may happen before Eve accepts it.
              sessionStorage.setItem(storageKey, JSON.stringify(pending));
              setPendingMessage(pending);
              setDraft("");
              try {
                await send(
                  () =>
                    agent.send(submitted.trim(), {
                      headers: { "x-chatjs-selected-model": selectedModel },
                    }),
                  true
                );
              } catch (cause) {
                setDraft((current) => current || submitted);
                throw cause;
              }
            })
          }
          stopDisabled={cancelPending || agent.status === "resuming"}
          tools={
            <EveModelPicker
              disabled={
                busy || commandPending || hasApproval || !!pendingMessage
              }
            />
          }
        />
        {(error || agent.error || durableError) && (
          <Button
            disabled={busy || commandPending || cancelPending}
            onClick={() => run(agent.resume)}
            size="sm"
            type="button"
            variant="ghost"
          >
            Reconnect
          </Button>
        )}
      </div>
    </div>
  );
}
