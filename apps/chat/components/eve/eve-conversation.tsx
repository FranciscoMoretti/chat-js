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
import {
  expandSelectedModelValue,
  frontendToolsSchema,
  getPrimarySelectedModelId,
  type SelectedModelValue,
  type UiToolName,
} from "@/lib/ai/types";
import { isEveCommandRejection } from "@/lib/eve/command-rejection";
import { eveDocumentOperations } from "@/lib/eve/document-contracts";
import {
  draftAttachment,
  draftMessage,
  matchesDraft,
  restoreDraft,
} from "@/lib/eve/draft";
import { eveMessageTool } from "@/lib/eve/message-tool-selection";
import { sendCommand } from "@/lib/eve/send-command";
import {
  useDefaultModel,
  useModelChange,
} from "@/providers/default-model-provider";
import { useTRPC } from "@/trpc/react";
import { EveArtifactLayout } from "./eve-artifact-layout";
import { EveComposer } from "./eve-composer";
import { EveForkControls } from "./eve-fork-controls";
import { EveMessages } from "./eve-messages";
import type { EveResponseCardCandidate } from "./eve-response-group-cards";
import { useEveAttachments } from "./use-eve-attachments";
import { useEveComposerDraft } from "./use-eve-composer-draft";
import { useEveFork } from "./use-eve-fork";

const pendingMessageSchema = z.object({
  operationId: z.uuid().optional(),
  message: z.string(),
  attachments: z.array(draftAttachment).default([]),
  modelId: z.string().optional(),
  selectedTool: frontendToolsSchema.optional(),
  afterSequence: z.number(),
  checkUntil: z.number(),
  rejection: z.string().optional(),
});

export function EveConversation({
  sessionId,
  conversationId,
  ownerId,
  header,
  onStatusChange,
  draftScopeId,
  onNavigationBlockedChange,
}: {
  sessionId: string;
  conversationId: string;
  ownerId: string;
  header: ReactNode;
  onStatusChange?: (status: EveResponseCardCandidate["status"]) => void;
  draftScopeId?: string;
  onNavigationBlockedChange?: (blocked: boolean) => void;
}) {
  const {
    fork,
    composerDraft,
    files,
    composerFiles,
    retainedDraft,
    comparison,
    modelSelection,
    modelIds,
  } = useConversationInput(ownerId, conversationId, draftScopeId);
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
  const { text: draft, setText: setDraft } = composerDraft;
  const [error, setError] = useState<Error>();
  const [commandPending, setCommandPending] = useState(false);
  const [cancelPending, setCancelPending] = useState(false);
  useEffect(() => {
    onNavigationBlockedChange?.(
      !composerDraft.loaded ||
        !!composerDraft.error ||
        files.uploadQueue.length > 0 ||
        fork.locked
    );
  }, [
    composerDraft.loaded,
    composerDraft.error,
    files.uploadQueue.length,
    fork.locked,
    onNavigationBlockedChange,
  ]);
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
  const displayedError = error?.message ?? agent.error?.message ?? durableError;
  // Failed provisional messages are retained in the recovery panel below.
  // They must not look like accepted transcript entries or survive a retry twice.
  const messages = agent.data.messages.filter(
    (message) =>
      !(message.metadata?.optimistic && message.metadata.status === "failed")
  );
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
    if (!pendingMessage || pendingMessage.rejection) {
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
          eveMessageTool({ metadata: { custom: event.data.metadata } }) ===
            (pending.selectedTool ?? null) &&
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
  useEffect(() => {
    let status: EveResponseCardCandidate["status"] = agent.status;
    if (displayedError) {
      status = "error";
    }
    if (hasApproval) {
      status = "awaiting-input";
    }
    onStatusChange?.(status);
  }, [agent.status, displayedError, hasApproval, onStatusChange]);
  async function run(action: () => Promise<unknown>) {
    if (commandLock.current) {
      return;
    }
    commandLock.current = true;
    setCommandPending(true);
    setError(undefined);
    commandError.current = undefined;
    try {
      await action();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause
          : new Error("Request failed. Reconnect before retrying.")
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
    clearComposer: boolean,
    selectedTool?: UiToolName
  ) {
    const pending = {
      operationId: crypto.randomUUID(),
      message: message.trim(),
      attachments,
      modelId,
      selectedTool,
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
      composerDraft.setSelectedTool(null);
    }
    try {
      await send(
        () =>
          agent.send(draftMessage(message, attachments), {
            headers: {
              "x-chatjs-message-operation": pending.operationId,
              "x-chatjs-selected-model": modelId,
              ...(selectedTool
                ? { "x-chatjs-selected-tool": selectedTool }
                : {}),
            },
          }),
        true
      );
    } catch (cause) {
      if (isEveCommandRejection(cause)) {
        const rejected = { ...pending, rejection: cause.message };
        sessionStorage.setItem(storageKey, JSON.stringify(rejected));
        setPendingMessage(rejected);
      }
      throw cause;
    }
  }
  async function cancel() {
    setCancelPending(true);
    afterCancellation.current += 1;
    try {
      await agent.cancel();
    } catch {
      setError(
        new Error("Cancellation failed. Reconnect to check the response.")
      );
    } finally {
      setCancelPending(false);
    }
  }
  const displayedTool = retainedToolSelection(
    comparison,
    pendingMessage,
    composerDraft.selectedTool
  );
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
                conversationId={conversationId}
                disabled={busy || commandPending}
                isReadonly={false}
                messages={messages}
                onEdit={(message) => fork.begin(message)}
                onRegenerate={(message, response) =>
                  fork.begin(message, { response, events: agent.events })
                }
                onSuggestion={(suggestion) =>
                  run(async () => {
                    if (modelIds.length > 1) {
                      await fork.compare(
                        draftMessage(suggestion, []),
                        modelIds,
                        nextTurnBoundary(latestTurn),
                        composerDraft.selectedTool ?? undefined,
                        false
                      );
                    } else {
                      await submitMessage(
                        suggestion,
                        [],
                        modelIds[0],
                        false,
                        composerDraft.selectedTool ?? undefined
                      );
                    }
                  })
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
            {[displayedError, composerDraft.error]
              .filter(Boolean)
              .map((message) => (
                <p key={message} role="alert">
                  {message}
                </p>
              ))}
            {pendingMessage && !commandPending && (
              <div className="space-y-2 text-sm" role="status">
                <p>
                  {pendingMessage.rejection
                    ? `Message was not sent: ${pendingMessage.rejection}. Your draft is saved in this tab.`
                    : "Message delivery is unconfirmed. Your draft is saved in this tab."}
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
                    composerDraft.setSelectedTool(
                      pendingMessage.selectedTool ?? null
                    );
                    sessionStorage.removeItem(storageKey);
                    setPendingMessage(null);
                    setError(
                      pendingMessage.rejection
                        ? undefined
                        : new Error(
                            "Delivery is unconfirmed. Check the conversation before sending this message again."
                          )
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
                !composerDraft.loaded ||
                busy ||
                commandPending ||
                cancelPending ||
                hasApproval ||
                !!pendingMessage ||
                fork.locked
              }
              draft={retainedDraft?.text ?? draft}
              files={composerFiles}
              modelSelection={modelSelection}
              onDraftChange={setDraft}
              onStop={cancel}
              onSubmit={() =>
                run(async () => {
                  if (modelIds.length > 1) {
                    await fork.compare(
                      draftMessage(draft, files.attachments),
                      modelIds,
                      nextTurnBoundary(latestTurn),
                      composerDraft.selectedTool ?? undefined
                    );
                  } else {
                    await submitMessage(
                      draft,
                      files.attachments,
                      modelIds[0],
                      true,
                      composerDraft.selectedTool ?? undefined
                    );
                  }
                })
              }
              onToolChange={composerDraft.setSelectedTool}
              readOnly={!!comparison}
              retainedModelId={pendingMessage?.modelId}
              retainedModelIds={comparison?.modelIds}
              selectedTool={displayedTool}
              stopDisabled={cancelPending || agent.status === "resuming"}
            />
            {displayedError &&
              !pendingMessage?.rejection &&
              !isEveCommandRejection(error ?? agent.error) && (
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

function sameComposerDraft(
  draft: ReturnType<typeof restoreDraft>,
  sent: ReturnType<typeof restoreDraft>
) {
  return (
    draft.text.trim() === sent.text.trim() &&
    draft.attachments.length === sent.attachments.length &&
    draft.attachments.every(
      (file, index) => file.url === sent.attachments[index]?.url
    )
  );
}

function nextTurnBoundary(
  event: ReturnType<typeof useEveAgent>["events"][number] | undefined
) {
  if (
    !(
      event &&
      (event.type === "turn.completed" ||
        event.type === "turn.failed" ||
        event.type === "turn.cancelled")
    )
  ) {
    throw new Error(
      "Wait for the conversation to finish restoring before comparing responses."
    );
  }
  return `turn_${BigInt(event.data.turnId.slice(5)) + 1n}`;
}

function useConversationInput(
  ownerId: string,
  conversationId: string,
  draftScopeId?: string
) {
  const changeModel = useModelChange();
  const [selection, setSelection] = useState<SelectedModelValue>();
  const selectedModel = useDefaultModel();
  const composerDraft = useEveComposerDraft(
    ownerId,
    draftScopeId ?? conversationId
  );
  const files = useEveAttachments(composerDraft);
  const fork = useEveFork(
    ownerId,
    conversationId,
    (message, selectedTool, clearComposer) => {
      const sent = restoreDraft(message);
      if (
        clearComposer &&
        sameComposerDraft(composerDraft, sent) &&
        composerDraft.selectedTool === (selectedTool ?? null)
      ) {
        composerDraft.setText("");
        files.setAttachments([]);
        composerDraft.setSelectedTool(null);
      }
    }
  );
  const comparison =
    fork.pending && "modelIds" in fork.pending ? fork.pending : undefined;
  const retainedDraft = comparison
    ? restoreDraft(comparison.message)
    : undefined;

  return {
    fork,
    composerDraft,
    files,
    retainedDraft,
    comparison,
    composerFiles: retainedDraft
      ? { ...files, attachments: retainedDraft.attachments }
      : files,
    modelIds: expandSelectedModelValue(selection ?? selectedModel),
    modelSelection: {
      value: selection ?? selectedModel,
      onChange: async (value: SelectedModelValue) => {
        setSelection(value);
        const primary = getPrimarySelectedModelId(value);
        if (primary) {
          await changeModel(primary);
        }
      },
    },
  };
}

function retainedToolSelection(
  comparison: { selectedTool?: UiToolName } | undefined,
  pending: { selectedTool?: UiToolName } | null,
  draft: UiToolName | null
) {
  const retained = comparison ?? pending;
  return retained ? (retained.selectedTool ?? null) : draft;
}
