"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEveAgent } from "eve/react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { z } from "zod";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { AttachmentList } from "@/components/attachment-list";
import { Button } from "@/components/ui/button";
import { eveDocumentOperations } from "@/lib/eve/document-contracts";
import { draftAttachment, draftMessage, matchesDraft } from "@/lib/eve/draft";
import { sendCommand } from "@/lib/eve/send-command";
import { useDefaultModel } from "@/providers/default-model-provider";
import { useTRPC } from "@/trpc/react";
import { EveArtifactLayout } from "./eve-artifact-layout";
import { EveComposer } from "./eve-composer";
import { EveForkControls } from "./eve-fork-controls";
import { EveMessages } from "./eve-messages";
import { useEveAttachments } from "./use-eve-attachments";
import { useEveFork } from "./use-eve-fork";

const pendingMessageSchema = z.object({
  message: z.string(),
  attachments: z.array(draftAttachment).default([]),
  modelId: z.string().optional(),
  afterSequence: z.number(),
  checkUntil: z.number(),
});

export function EveConversation({
  sessionId,
  conversationId,
  ownerId,
  header,
}: {
  sessionId: string;
  conversationId: string;
  ownerId: string;
  header: ReactNode;
}) {
  const fork = useEveFork(ownerId, conversationId);
  const selectedModel = useDefaultModel();
  const files = useEveAttachments();
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
      if (
        event.type === "action.result" &&
        event.data.result.kind === "tool-result" &&
        Object.hasOwn(eveDocumentOperations, event.data.result.toolName)
      ) {
        queryClient
          .invalidateQueries({ queryKey: trpc.eve.document.pathKey() })
          .catch(() => undefined);
      }
      if (event.type === "turn.completed") {
        queryClient
          .invalidateQueries({ queryKey: trpc.eve.list.pathKey() })
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
    const pending = pendingMessage;
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function reconcile() {
      for (const event of agent.events) {
        if (
          event.type === "message.received" &&
          event.data.sequence > pending.afterSequence &&
          (await matchesDraft(
            event.data.parts ?? event.data.message,
            pending.message,
            pending.attachments
          ))
        ) {
          if (!disposed) {
            sessionStorage.removeItem(storageKey);
            setPendingMessage(null);
          }
          return;
        }
      }
      // Poll the native log after an ambiguous POST; never resend automatically.
      if (
        !(disposed || busy || commandPending) &&
        Date.now() < pending.checkUntil
      ) {
        timer = setTimeout(() => {
          agent.resume().catch(() => undefined);
        }, 2000);
      }
    }
    reconcile().catch(() => undefined);
    return () => {
      disposed = true;
      clearTimeout(timer);
    };
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
  async function submitMessage(
    message: string,
    attachments: z.infer<typeof draftAttachment>[],
    modelId: string,
    clearComposer: boolean
  ) {
    const pending = {
      message: message.trim(),
      attachments,
      modelId,
      checkUntil: Date.now() + 60_000,
      afterSequence: Math.max(
        -1,
        ...agent.events.flatMap((event) =>
          event.type === "message.received" ? [event.data.sequence] : []
        )
      ),
    };
    // Save before sending: a reload may happen before Eve accepts it.
    sessionStorage.setItem(storageKey, JSON.stringify(pending));
    setPendingMessage(pending);
    if (clearComposer) {
      setDraft("");
      files.setAttachments([]);
    }
    await send(
      () =>
        agent.send(draftMessage(message, attachments), {
          headers: { "x-chatjs-selected-model": modelId },
        }),
      true
    );
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
    <EveArtifactLayout
      conversationId={conversationId}
      documentActionsDisabled={
        busy ||
        commandPending ||
        cancelPending ||
        hasApproval ||
        Boolean(pendingMessage) ||
        fork.locked
      }
      messages={agent.data.messages}
      onDocumentAction={({ message, modelId }) =>
        run(() => submitMessage(message, [], modelId, false))
      }
    >
      <section className="flex h-full min-h-0 flex-col">
        {header}
        <div className="flex min-h-0 flex-1 flex-col">
          <EveForkControls
            conversationId={conversationId}
            disabled={busy || commandPending || hasApproval || !!pendingMessage}
            fork={fork}
          />
          <Conversation>
            <ConversationContent className="mx-auto w-full max-w-3xl">
              <EveMessages
                actionsDisabled={
                  busy ||
                  commandPending ||
                  fork.locked ||
                  !fork.family.data ||
                  hasApproval ||
                  !!pendingMessage
                }
                disabled={busy || commandPending}
                isReadonly={false}
                messages={agent.data.messages}
                onEdit={(message) => fork.begin(message)}
                onRegenerate={(message, response) =>
                  fork.begin(message, { response, events: agent.events })
                }
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
              <p role="alert">
                {error || agent.error?.message || durableError}
              </p>
            )}
            {pendingMessage && !commandPending && (
              <div className="space-y-2 text-sm" role="status">
                <p>
                  Message delivery is unconfirmed. Your draft is saved in this
                  tab.
                </p>
                <p className="whitespace-pre-wrap">{pendingMessage.message}</p>
                <AttachmentList attachments={pendingMessage.attachments} />
                <Button
                  onClick={() => {
                    setDraft((current) =>
                      current
                        ? `${current}\n\n${pendingMessage.message}`
                        : pendingMessage.message
                    );
                    files.setAttachments((current) => [
                      ...current,
                      ...pendingMessage.attachments.filter(
                        (file) =>
                          !current.some((existing) => existing.url === file.url)
                      ),
                    ]);
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
            <EveComposer
              busy={busy}
              disabled={
                busy ||
                commandPending ||
                cancelPending ||
                hasApproval ||
                !!pendingMessage ||
                fork.locked
              }
              draft={draft}
              files={files}
              onDraftChange={setDraft}
              onStop={cancel}
              onSubmit={() =>
                run(() =>
                  submitMessage(draft, files.attachments, selectedModel, true)
                )
              }
              retainedModelId={pendingMessage?.modelId}
              stopDisabled={cancelPending || agent.status === "resuming"}
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
      </section>
    </EveArtifactLayout>
  );
}
