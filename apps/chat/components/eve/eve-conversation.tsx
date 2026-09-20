"use client";

import type { useEveAgent } from "eve/react";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";

import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { AttachmentList } from "@/components/attachment-list";
import { Button } from "@/components/ui/button";
import {
  expandSelectedModelValue,
  getPrimarySelectedModelId,
} from "@/lib/ai/types";
import type { SelectedModelValue, UiToolName } from "@/lib/ai/types";
import { isEveCommandRejection } from "@/lib/eve/command-rejection";
import { draftMessage, restoreDraft } from "@/lib/eve/draft";
import type { DraftAttachment } from "@/lib/eve/draft";
import { eveUserForkBoundary } from "@/lib/eve/fork-source";
import { logicalResponseSlots } from "@/lib/eve/logical-response-slots";
import { EVE_MESSAGE_OPERATION_HEADER } from "@/lib/eve/message-delivery";
import type { EveMessageInput } from "@/lib/eve/message-input";
import { responseModelReferences } from "@/lib/eve/response-model";
import { sendCommand } from "@/lib/eve/send-command";
import {
  useDefaultModel,
  useModelChange,
} from "@/providers/default-model-provider";

import { EveArtifactLayout } from "./eve-artifact-layout";
import { EveComposer } from "./eve-composer";
import { EveForkRecovery } from "./eve-fork-recovery";
import { EveInitialMessage } from "./eve-initial-message";
import { useLogicalChat } from "./eve-logical-context";
import {
  EveLogicalVersions,
  EveLogicalResponses,
} from "./eve-logical-navigation";
import { EveMessages } from "./eve-messages";
import {
  EveOptimisticResponseGroup,
  shouldAppendEveOptimisticResponseGroup,
} from "./eve-optimistic-response-group";
import { useEveAttachments } from "./use-eve-attachments";
import { useEveComposerDraft } from "./use-eve-composer-draft";
import { useEveFork } from "./use-eve-fork";
import { useEveMessageDelivery } from "./use-eve-message-delivery";
import { useLogicalCommands } from "./use-logical-commands";

// This controller coordinates streaming, optimistic delivery, recovery, and comparison state.
// oxlint-disable-next-line eslint/complexity
export const EveConversation = ({
  sessionId,
  conversationId,
  ownerId,
  header,
  draftScopeId,
  initialMessage,
}: {
  sessionId: string;
  conversationId: string;
  ownerId: string;
  header: ReactNode;
  initialMessage?: EveMessageInput;
  draftScopeId?: string;
}) => {
  const {
    fork,
    composerDraft,
    files,
    comparison,
    modelSelection,
    modelIds,
    // The input hook owns the shared composer/fork lifecycle for this controller.
    // oxlint-disable-next-line eslint/no-use-before-define
  } = useConversationInput(ownerId, conversationId, draftScopeId);
  const delivery = useEveMessageDelivery(sessionId);
  const pendingMessage = delivery.pending;
  const { controller, snapshot } = useLogicalChat();
  const command = useLogicalCommands(controller.commands, conversationId);
  const commandFailure = command.failure;
  const commandPending = command.pending;
  const cancelPending = command.cancelling;
  const setCommandFailure = (failure?: Error) =>
    controller.commands.update(conversationId, { failure });
  const setCancelPending = (cancelling: boolean) =>
    controller.commands.update(conversationId, { cancelling });
  const { text: draft, setText: setDraft } = composerDraft;
  const agent = snapshot.agents.get(conversationId);
  if (!agent) {
    throw new Error("Native observer is not ready.");
  }
  const acceptDelivery = delivery.accept;
  useEffect(() => {
    for (const event of agent.events) {
      acceptDelivery(event);
    }
  }, [agent.events, acceptDelivery]);
  const latestTurn = agent.events.findLast(
    (event) =>
      event.type === "turn.started" ||
      event.type === "turn.failed" ||
      event.type === "turn.completed" ||
      event.type === "turn.cancelled"
  );
  const durableError =
    latestTurn?.type === "turn.failed" ? latestTurn.data.message : undefined;
  const displayedError =
    commandFailure?.message ?? agent.error?.message ?? durableError;
  // Failed provisional messages are retained in the recovery panel below.
  // They must not look like accepted transcript entries or survive a retry twice.
  const selectedPath = new Set<string>();
  let selectedNode = snapshot.cursorId
    ? snapshot.nodes.get(snapshot.cursorId)
    : undefined;
  while (selectedNode) {
    selectedPath.add(selectedNode.id);
    selectedNode = selectedNode.parentId
      ? snapshot.nodes.get(selectedNode.parentId)
      : undefined;
  }
  const messages = agent.data.messages
    .filter((message) => {
      if (
        message.metadata?.optimistic &&
        message.metadata.status === "failed"
      ) {
        return false;
      }
      const logicalId = controller.logicalId(conversationId, message.id);
      return !snapshot.cursorId || (!!logicalId && selectedPath.has(logicalId));
    })
    .map((message) => {
      const id = controller.logicalId(conversationId, message.id);
      const canonical = id ? snapshot.nodes.get(id)?.message : undefined;
      return canonical ? { ...message, parts: canonical.parts } : message;
    });
  const editingMessageId =
    fork.editingMessageId ??
    messages.find(
      (message) =>
        eveUserForkBoundary(message) === fork.editingBoundary &&
        !!fork.editingBoundary
    )?.id;
  const responseModels = responseModelReferences(agent.events);
  const modelForMessage = (message: (typeof messages)[number]) => {
    const reference = message.metadata?.turnId
      ? responseModels.get(message.metadata.turnId)
      : message.metadata?.modelId;
    const separator = reference?.indexOf("/") ?? -1;
    return reference && separator > 0 && separator < reference.length - 1
      ? reference.slice(separator + 1)
      : undefined;
  };
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
  const run = async (action: () => Promise<unknown>) => {
    if (!controller.commands.claim(conversationId)) {
      return;
    }
    setCommandFailure(undefined);
    // oxlint-disable-next-line react/todo -- Preserve command lock cleanup while React Compiler lacks finally support.
    try {
      await action();
    } catch (error) {
      setCommandFailure(
        error instanceof Error
          ? error
          : new Error("Request failed. Reconnect before retrying.")
      );
      // oxlint-disable-next-line react/todo -- React Compiler cannot analyze required command lock cleanup in finally.
    } finally {
      controller.commands.update(conversationId, { pending: false });
    }
  };
  const send = async (action: () => Promise<void>, operationId?: string) => {
    const { cancellation } = controller.commands.get(conversationId);
    await sendCommand(
      action,
      agent.resume,
      cancellation > 0,
      () => controller.getSnapshot().agents.get(conversationId)?.error,
      () => !operationId || delivery.hasAcknowledged(operationId)
    );
    if (controller.commands.get(conversationId).cancellation === cancellation) {
      controller.commands.update(conversationId, { cancellation: 0 });
    }
  };
  const submitMessage = async (
    message: string,
    attachments: DraftAttachment[],
    modelId: string,
    clearComposer: boolean,
    selectedTool?: UiToolName
  ) => {
    controller.selectBranch(conversationId);
    const pending = delivery.begin({
      attachments,
      message: message.trim(),
      modelId,
      selectedTool,
    });
    if (clearComposer) {
      setDraft("");
      files.setAttachments([]);
      composerDraft.setSelectedTool(null);
    }
    // oxlint-disable-next-line react/todo -- Preserve optimistic message recovery cleanup while React Compiler lacks finally support.
    try {
      await send(
        () =>
          agent.send(draftMessage(message, attachments), {
            headers: {
              [EVE_MESSAGE_OPERATION_HEADER]: pending.operationId,
              "x-chatjs-selected-model": modelId,
              ...(selectedTool
                ? { "x-chatjs-selected-tool": selectedTool }
                : {}),
            },
          }),
        pending.operationId
      );
    } catch (error) {
      if (isEveCommandRejection(error)) {
        delivery.reject(pending, error.message);
      }
      throw error;
    }
  };
  const cancel = async () => {
    setCancelPending(true);
    controller.commands.update(conversationId, {
      cancellation: controller.commands.get(conversationId).cancellation + 1,
    });
    try {
      await agent.cancel();
    } catch {
      setCommandFailure(
        new Error("Cancellation failed. Reconnect to check the response.")
      );
      // oxlint-disable-next-line react/todo -- React Compiler cannot analyze required cancellation cleanup in finally.
    } finally {
      setCancelPending(false);
    }
  };
  // Retain the selected tool across a pending or comparison recovery flow.
  // oxlint-disable-next-line eslint/no-use-before-define
  const displayedTool = retainedToolSelection(
    comparison,
    pendingMessage,
    composerDraft.selectedTool
  );
  const handleSelectedToolChange = composerDraft.setSelectedTool;
  const handleEditDraft = fork.setDraft;
  const handleEditSubmit = fork.submit;
  const handleEditToolChange = fork.setSelectedTool;
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
          <Conversation>
            <ConversationContent className="mx-auto w-full max-w-3xl">
              {initialMessage && messages.length === 0 && (
                <EveInitialMessage message={initialMessage} />
              )}
              <EveMessages
                actionsDisabled={
                  busy ||
                  commandPending ||
                  fork.locked ||
                  !fork.family.data ||
                  !!snapshot.error ||
                  hasApproval ||
                  !!pendingMessage
                }
                conversationId={conversationId}
                disabled={busy || commandPending}
                isReadonly={false}
                messages={messages}
                editor={
                  editingMessageId
                    ? {
                        content: (
                          <div className="w-full">
                            <EveComposer
                              autoFocus
                              busy={fork.busy}
                              disabled={
                                busy ||
                                commandPending ||
                                hasApproval ||
                                !!pendingMessage ||
                                fork.locked
                              }
                              readOnly={!!fork.pending}
                              draft={fork.draft}
                              files={fork.files}
                              modelSelection={fork.modelSelection}
                              onDraftChange={handleEditDraft}
                              onSubmit={handleEditSubmit}
                              onToolChange={handleEditToolChange}
                              selectedTool={fork.selectedTool}
                            />
                            {fork.error && (
                              <p
                                className="text-destructive text-sm"
                                role="alert"
                              >
                                {fork.error}
                              </p>
                            )}
                          </div>
                        ),
                        disabled: fork.busy || !!fork.pending,
                        messageId: editingMessageId,
                        onCancel: fork.cancelEdit,
                      }
                    : undefined
                }
                modelForMessage={modelForMessage}
                renderVersions={(message) => (
                  <EveLogicalVersions
                    conversationId={conversationId}
                    messageId={message.id}
                    disabled={
                      fork.locked || !!editingMessageId || !!pendingMessage
                    }
                  />
                )}
                renderResponses={(message) => (
                  <EveLogicalResponses
                    conversationId={conversationId}
                    messageId={message.id}
                    disabled={
                      fork.locked || !!editingMessageId || !!pendingMessage
                    }
                  />
                )}
                messageKey={(message) =>
                  controller.logicalId(conversationId, message.id) ??
                  `${sessionId}:${message.id}`
                }

                onEdit={(message) => {
                  const following = messages.slice(
                    messages.indexOf(message) + 1
                  );
                  const nextUser = following.findIndex(
                    (candidate) => candidate.role === "user"
                  );
                  const response = following
                    .slice(0, nextUser === -1 ? following.length : nextUser)
                    .find((candidate) => candidate.role === "assistant");
                  const logicalId = controller.logicalId(
                    conversationId,
                    message.id
                  );
                  const group = logicalId
                    ? logicalResponseSlots(snapshot, logicalId)
                    : undefined;
                  const groupModels: Record<string, number> = {};
                  for (const slot of group?.slots ?? []) {
                    groupModels[slot.modelId] =
                      (groupModels[slot.modelId] ?? 0) + 1;
                  }
                  return fork.begin(message, undefined, {
                    events: agent.events,
                    modelSelection: group ? groupModels : undefined,
                    response:
                      response && modelForMessage(response)
                        ? response
                        : undefined,
                  });
                }}
                onRegenerate={(message, response) =>
                  fork.begin(message, { events: agent.events, response })
                }
                onSuggestion={(suggestion) =>
                  run(async () => {
                    // oxlint-disable-next-line unicorn/prefer-ternary -- The branches perform distinct async recovery operations.
                    if (modelIds.length > 1) {
                      await fork.compare(
                        draftMessage(suggestion, []),
                        modelIds,
                        /* oxlint-disable-next-line eslint/no-use-before-define -- Boundary derives from the latest streamed turn. */
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
              {comparison &&
                shouldAppendEveOptimisticResponseGroup(comparison) && (
                  <EveOptimisticResponseGroup operation={comparison} />
                )}
            </ConversationContent>
            <ConversationScrollButton />
          </Conversation>
          <div className="mx-auto w-full max-w-3xl space-y-3 p-4">
            <EveForkRecovery fork={fork} showError={!editingMessageId} />
            <p aria-live="polite" className="sr-only">
              {statusLabel}
            </p>
            {[snapshot.error, displayedError, composerDraft.error]
              .filter(Boolean)
              .map((message) => (
                <p key={message} role="alert">
                  {message}
                </p>
              ))}
            {pendingMessage && !commandPending && (
              <output className="space-y-2 text-sm">
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
                    delivery.release(pendingMessage);
                    setCommandFailure(
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
              </output>
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
              draft={draft}
              files={files}
              modelSelection={modelSelection}
              onDraftChange={setDraft}
              onStop={cancel}
              onSubmit={() =>
                run(async () => {
                  // oxlint-disable-next-line unicorn/prefer-ternary -- The branches perform distinct async recovery operations.
                  if (modelIds.length > 1) {
                    await fork.compare(
                      draftMessage(draft, files.attachments),
                      modelIds,
                      /* oxlint-disable-next-line eslint/no-use-before-define -- Boundary derives from the latest streamed turn. */
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
              onToolChange={handleSelectedToolChange}
              readOnly={!!comparison}
              retainedModelId={pendingMessage?.modelId}
              retainedModelIds={comparison?.modelIds}
              selectedTool={displayedTool}
              stopDisabled={cancelPending || agent.status === "resuming"}
            />
            {displayedError &&
              !pendingMessage?.rejection &&
              !isEveCommandRejection(commandFailure ?? agent.error) && (
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
};

const sameComposerDraft = (
  draft: ReturnType<typeof restoreDraft>,
  sent: ReturnType<typeof restoreDraft>
) =>
  draft.text.trim() === sent.text.trim() &&
  draft.attachments.length === sent.attachments.length &&
  draft.attachments.every(
    (file, index) => file.url === sent.attachments[index]?.url
  );

const nextTurnBoundary = (
  event: ReturnType<typeof useEveAgent>["events"][number] | undefined
) => {
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
};

const useConversationInput = (
  ownerId: string,
  conversationId: string,
  draftScopeId?: string
) => {
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

  return {
    comparison,
    composerDraft,
    files,
    fork,
    modelIds: expandSelectedModelValue(selection ?? selectedModel),
    modelSelection: {
      onChange: async (value: SelectedModelValue) => {
        setSelection(value);
        const primary = getPrimarySelectedModelId(value);
        if (primary) {
          await changeModel(primary);
        }
      },
      value: selection ?? selectedModel,
    },
  };
};

const retainedToolSelection = (
  comparison: { selectedTool?: UiToolName } | undefined,
  pending: { selectedTool?: UiToolName } | null,
  draft: UiToolName | null
) => {
  const retained = comparison ?? pending;
  return retained ? (retained.selectedTool ?? null) : draft;
};
