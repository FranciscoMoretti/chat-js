"use client";

import { useEveDeliveryReceipt } from "./use-eve-delivery-receipt";

import { PluginSuggestions } from "@/components/plugin-chat-ui";

import { withTaskCleanup } from "@/components/task-cleanup";

import { hasText } from "@/components/text-value";

import type { useEveAgent } from "eve/react";
import React, { useState } from "react";
import type { JSX as ReactJSX, ReactNode } from "react";

import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller";
import { AttachmentList } from "@/components/attachment-list";
import { Button } from "@/components/ui/button";
import type { SelectedModelValue, UiToolName } from "@/lib/ai/types";
import {
  expandSelectedModelValue,
  getPrimarySelectedModelId,
} from "@/lib/ai/types";
import { isEveAdmissionBusy } from "@/lib/eve/admission-retry";
import { isEveCommandRejection } from "@/lib/eve/command-rejection";
import { draftMessage, restoreDraft } from "@/lib/eve/draft";
import type { DraftAttachment } from "@/lib/eve/draft";
import { logicalResponseSlots } from "@/lib/eve/logical-response-slots";
import type { LogicalChat, LogicalChatSnapshot } from "@/lib/eve/logical-chat";
import type { ActivePendingEveMessage } from "@/lib/eve/message-delivery";
import { EVE_MESSAGE_OPERATION_HEADER } from "@/lib/eve/message-delivery";
import type { ReadonlyEveMessage } from "@/lib/eve/readonly-message-types";
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
  EveLogicalResponses,
  EveLogicalVersions,
} from "./eve-logical-navigation";
import { EveMessages } from "./eve-messages";
import {
  EveOptimisticResponseGroup,
  shouldAppendEveOptimisticResponseGroup,
} from "./eve-optimistic-response-group";
import { EveThinkingMessage } from "./eve-thinking-message";
import { useEveAttachments } from "./use-eve-attachments";
import { useEveComposerDraft } from "./use-eve-composer-draft";
import { useEveFork } from "./use-eve-fork";
import { useEveMessageDelivery } from "./use-eve-message-delivery";
import { useLogicalCommands } from "./use-logical-commands";

const sameComposerDraft = (
  draft: {
    readonly text: string;
    readonly attachments: readonly Readonly<DraftAttachment>[];
  },
  sent: {
    readonly text: string;
    readonly attachments: readonly Readonly<DraftAttachment>[];
  }
): boolean =>
  draft.text.trim() === sent.text.trim() &&
  draft.attachments.length === sent.attachments.length &&
  draft.attachments.every(
    (file, index) => file.url === sent.attachments[index]?.url
  );

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
        if (typeof primary === "string" && primary !== "") {
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
  if (retained) {
    return retained.selectedTool ?? null;
  }
  return draft;
};

const conversationStatus = (
  status: string,
  busy: boolean,
  hasApproval: boolean,
  cancelPending: boolean
): string => {
  let label = "Ready";
  if (busy) {
    label = "Responding…";
  }
  if (status === "resuming") {
    label = "Loading conversation";
  }
  if (hasApproval) {
    label = "Waiting for your input";
  }
  if (cancelPending) {
    label = "Stopping…";
  }
  return label;
};

const isInputResponseDisabled = (
  status: string | undefined,
  commandPending: boolean
): boolean => commandPending || status === "submitted" || status === "resuming";

const isExecutionBusy = (status: string | undefined): boolean =>
  status === "streaming" || status === "submitted" || status === "resuming";

const selectedConversationMessages = (
  messages: readonly ReadonlyEveMessage[],
  controller: Readonly<Pick<LogicalChat, "logicalId">>,
  snapshot: Readonly<Pick<LogicalChatSnapshot, "cursorId" | "nodes">>,
  conversationId: string
): readonly ReadonlyEveMessage[] => {
  const selectedPath = new Set<string>();
  let selectedNode = hasText(snapshot.cursorId)
    ? snapshot.nodes.get(snapshot.cursorId)
    : undefined;
  while (selectedNode) {
    selectedPath.add(selectedNode.id);
    selectedNode = hasText(selectedNode.parentId)
      ? snapshot.nodes.get(selectedNode.parentId)
      : undefined;
  }
  return messages
    .filter((message) => {
      if (
        message.metadata?.optimistic &&
        message.metadata.status === "failed"
      ) {
        return false;
      }
      const logicalId = controller.logicalId(conversationId, message.id);
      return (
        !hasText(snapshot.cursorId) ||
        (hasText(logicalId) && selectedPath.has(logicalId))
      );
    })
    .map((message) => {
      const id = controller.logicalId(conversationId, message.id);
      const canonical =
        typeof id === "string" && id !== ""
          ? snapshot.nodes.get(id)?.message
          : undefined;
      if (canonical) {
        return { ...message, parts: canonical.parts };
      }
      return message;
    });
};

const EveConversationEditor = ({
  fork,
  busy,
  commandPending,
  hasApproval,
  pendingMessage,
  onSubmit,
}: {
  readonly fork: ReturnType<typeof useConversationInput>["fork"];
  readonly busy: boolean;
  readonly commandPending: boolean;
  readonly hasApproval: boolean;
  readonly pendingMessage: ReturnType<typeof useEveMessageDelivery>["pending"];
  readonly onSubmit: () => void;
}): ReactJSX.Element => {
  const handleEditDraft = fork.setDraft;
  const handleEditToolChange = fork.setSelectedTool;
  return (
    <div className="w-full">
      <p className="text-muted-foreground mb-2 text-sm">
        Replace this message in a new branch. Later messages are not included.
        All branches share workspace files and the installed environment.
        Forking does not roll files back.
      </p>
      <EveComposer
        autoFocus
        status={fork.busy ? "submitted" : "ready"}
        disabled={
          busy ||
          commandPending ||
          hasApproval ||
          Boolean(pendingMessage) ||
          fork.locked
        }
        readOnly={Boolean(fork.pending)}
        draft={fork.draft}
        files={fork.files}
        modelSelection={fork.modelSelection}
        onDraftChange={handleEditDraft}
        onSubmit={onSubmit}
        onToolChange={handleEditToolChange}
        selectedTool={fork.selectedTool}
      />
      {fork.error && (
        <p className="text-destructive text-sm" role="alert">
          {fork.error}
        </p>
      )}
    </div>
  );
};

const EveDeliveryRecovery = ({
  pendingMessage,
  delivery,
  composerDraft,
  files,
  run,
  sendPendingMessage,
  setCommandFailure,
}: {
  readonly pendingMessage: NonNullable<
    ReturnType<typeof useEveMessageDelivery>["pending"]
  >;
  readonly delivery: ReturnType<typeof useEveMessageDelivery>;
  readonly composerDraft: ReturnType<
    typeof useConversationInput
  >["composerDraft"];
  readonly files: ReturnType<typeof useConversationInput>["files"];
  readonly run: (action: () => Promise<unknown>) => Promise<void>;
  readonly sendPendingMessage: (
    pending: ActivePendingEveMessage
  ) => Promise<void>;
  readonly setCommandFailure: (failure?: Error) => void;
}): ReactJSX.Element => (
  <output className="space-y-2 text-sm">
    <p>
      {hasText(pendingMessage.rejection)
        ? `Message was not sent: ${pendingMessage.rejection}. Your draft is saved in this tab.`
        : "Message delivery is unknown. This operation will not be sent again. Your draft is saved in this tab."}
    </p>
    <p className="whitespace-pre-wrap">{pendingMessage.message}</p>
    <AttachmentList attachments={pendingMessage.attachments} />
    <div className="flex flex-wrap gap-2">
      {pendingMessage.retryable === true &&
        hasText(pendingMessage.operationId) && (
          <Button
            onClick={() => {
              void run(async () => {
                const retried = delivery.retry(pendingMessage);
                if (retried) {
                  await sendPendingMessage(retried);
                }
              });
            }}
            size="sm"
            type="button"
            variant="outline"
          >
            Retry message
          </Button>
        )}
      <Button
        onClick={() => {
          composerDraft.setText((current) => {
            if (current) {
              return `${current}\n\n${pendingMessage.message}`;
            }
            return pendingMessage.message;
          });
          files.setAttachments((current) => [
            ...current,
            ...pendingMessage.attachments.filter(
              (file) => !current.some((existing) => existing.url === file.url)
            ),
          ]);
          composerDraft.setSelectedTool(pendingMessage.selectedTool ?? null);
          delivery.release(pendingMessage);
          setCommandFailure(
            hasText(pendingMessage.rejection)
              ? undefined
              : new Error(
                  "The original operation remains unresolved. Sending this restored draft creates a new message and may duplicate it."
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
  </output>
);

const conversationActionLocks = ({
  busy,
  commandPending,
  cancelPending,
  hasApproval,
  pendingMessage,
  fork,
  snapshotError,
  editingMessageId,
}: {
  readonly busy: boolean;
  readonly commandPending: boolean;
  readonly cancelPending: boolean;
  readonly hasApproval: boolean;
  readonly pendingMessage: ReturnType<typeof useEveMessageDelivery>["pending"];
  readonly fork: ReturnType<typeof useConversationInput>["fork"];
  readonly snapshotError: string | undefined;
  readonly editingMessageId: string | undefined;
}) => ({
  document:
    busy ||
    commandPending ||
    cancelPending ||
    hasApproval ||
    Boolean(pendingMessage) ||
    fork.locked,
  transcript:
    busy ||
    commandPending ||
    fork.locked ||
    !fork.family.data ||
    Boolean(snapshotError) ||
    hasApproval ||
    Boolean(pendingMessage),
  navigation:
    fork.locked || Boolean(editingMessageId) || Boolean(pendingMessage),
});

const EveConversationComposer = ({
  input,
  pendingMessage,
  status,
  busy,
  commandPending,
  cancelPending,
  hasApproval,
  displayedError,
  commandFailure,
  agentError,
  onStop,
  onSubmit,
  onReconnect,
}: {
  readonly input: ReturnType<typeof useConversationInput>;
  readonly pendingMessage: ReturnType<typeof useEveMessageDelivery>["pending"];
  readonly status: ReturnType<typeof useEveAgent>["status"];
  readonly busy: boolean;
  readonly commandPending: boolean;
  readonly cancelPending: boolean;
  readonly hasApproval: boolean;
  readonly displayedError: string | undefined;
  readonly commandFailure: Error | undefined;
  readonly agentError: Error | undefined;
  readonly onStop: () => void;
  readonly onSubmit: () => void;
  readonly onReconnect: () => void;
}): ReactJSX.Element => {
  const { composerDraft, files, modelSelection, comparison, fork } = input;
  const handleSelectedToolChange = composerDraft.setSelectedTool;
  const handleDraftChange = composerDraft.setText;
  return (
    <>
      {input.modelIds.length > 1 && (
        <p className="text-muted-foreground mb-2 text-xs">
          Each model receives its own conversation history in the shared
          workspace. Turns run one at a time; changes to workspace files are
          visible to every branch.
        </p>
      )}
      <EveComposer
        status={status === "resuming" ? "submitted" : status}
        disabled={
          !composerDraft.loaded ||
          busy ||
          commandPending ||
          cancelPending ||
          hasApproval ||
          Boolean(pendingMessage) ||
          fork.locked
        }
        draft={composerDraft.text}
        files={files}
        modelSelection={modelSelection}
        onDraftChange={handleDraftChange}
        onStop={onStop}
        onSubmit={onSubmit}
        onToolChange={handleSelectedToolChange}
        readOnly={Boolean(comparison)}
        retainedModelId={pendingMessage?.modelId}
        retainedModelIds={comparison?.modelIds}
        selectedTool={retainedToolSelection(
          comparison,
          pendingMessage,
          composerDraft.selectedTool
        )}
        stopDisabled={cancelPending || status === "resuming"}
      />
      {hasText(displayedError) &&
        !hasText(pendingMessage?.rejection) &&
        !isEveCommandRejection(commandFailure ?? agentError) && (
          <Button
            disabled={busy || commandPending || cancelPending}
            onClick={onReconnect}
            size="sm"
            type="button"
            variant="ghost"
          >
            Reconnect
          </Button>
        )}
    </>
  );
};

// This controller coordinates streaming, optimistic delivery, recovery, and comparison state.

const EveConversation = ({
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
  readonly initialMessage?: Parameters<typeof restoreDraft>[0];
  draftScopeId?: string;
}): ReactJSX.Element => {
  const [, startEventAction] = React.useTransition();
  const input = useConversationInput(ownerId, conversationId, draftScopeId);
  const { fork, composerDraft, files, comparison, modelIds } = input;
  const delivery = useEveMessageDelivery(sessionId);
  const pendingMessage = delivery.pending;
  const { controller, snapshot } = useLogicalChat();
  const command = useLogicalCommands(controller.commands, conversationId);
  const commandFailure = command.failure;
  const commandPending = command.pending;
  const cancelPending = command.cancelling;
  const setCommandFailure = (failure?: Error): void => {
    controller.commands.update(conversationId, { failure });
  };
  const { text: draft, setText: setDraft } = composerDraft;
  const agent = snapshot.agents.get(conversationId);
  if (!agent) {
    throw new Error("Native observer is not ready.");
  }
  const refreshDeliveryReceipt = useEveDeliveryReceipt(
    sessionId,
    pendingMessage,
    delivery.accept
  );
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
  const messages = selectedConversationMessages(
    agent.data.messages,
    controller,
    snapshot,
    conversationId
  );
  const lastMessage = messages.at(-1);
  const editingMessageId =
    fork.editingMessageId ??
    messages.find(
      (message) =>
        message.id === fork.editingBoundary && Boolean(fork.editingBoundary)
    )?.id;
  const responseModels = responseModelReferences(agent.events);
  const modelForMessage = (
    message: Readonly<Pick<(typeof messages)[number], "metadata">>
  ): string | undefined => {
    const reference = hasText(message.metadata?.turnId)
      ? responseModels.get(message.metadata.turnId)
      : message.metadata?.modelId;
    const separator = reference?.indexOf("/") ?? -1;
    if (
      hasText(reference) &&
      separator > 0 &&
      separator < reference.length - 1
    ) {
      return reference.slice(separator + 1);
    }
    return undefined;
  };
  const busy = isExecutionBusy(agent.status);
  const hasApproval = agent.data.messages.some((message) =>
    message.parts.some(
      (part) =>
        part.type === "dynamic-tool" && part.state === "approval-requested"
    )
  );
  const run = async (action: () => Promise<unknown>): Promise<void> => {
    if (!controller.commands.claim(conversationId)) {
      return;
    }
    setCommandFailure(undefined);

    await withTaskCleanup(
      async () => {
        try {
          await action();
        } catch (error) {
          setCommandFailure(
            error instanceof Error
              ? error
              : new Error("Request failed. Reconnect to check its status.")
          );
        }
      },
      () => {
        controller.commands.update(conversationId, { pending: false });
      }
    );
  };
  const send = async (
    action: () => Promise<void>,
    operationId?: string
  ): Promise<void> => {
    const { cancellation } = controller.commands.get(conversationId);
    await sendCommand(
      action,
      agent.resume,
      cancellation > 0,
      () => controller.getSnapshot().agents.get(conversationId)?.error,
      () => !hasText(operationId) || delivery.hasAcknowledged(operationId)
    );
    if (controller.commands.get(conversationId).cancellation === cancellation) {
      controller.commands.update(conversationId, { cancellation: 0 });
    }
  };
  const sendPendingMessage = async (
    pending: ActivePendingEveMessage
  ): Promise<void> => {
    try {
      await send(async () => {
        await agent.send(draftMessage(pending.message, pending.attachments), {
          headers: {
            [EVE_MESSAGE_OPERATION_HEADER]: pending.operationId,
            ...(hasText(pending.modelId)
              ? { "x-chatjs-selected-model": pending.modelId }
              : {}),
            ...(pending.selectedTool
              ? { "x-chatjs-selected-tool": pending.selectedTool }
              : {}),
          },
        });
      }, pending.operationId);
      await refreshDeliveryReceipt(pending.operationId);
    } catch (error) {
      if (isEveCommandRejection(error)) {
        delivery.reject(pending, error.message, isEveAdmissionBusy(error));
      }
      throw error;
    }
  };
  const submitMessage = async (
    message: string,
    attachments: readonly Readonly<DraftAttachment>[],
    modelId: string,
    clearComposer: boolean,
    selectedTool?: UiToolName
  ): Promise<void> => {
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
    await sendPendingMessage(pending);
  };
  const cancelExecution = async (executionId: string): Promise<void> => {
    const execution = controller.getSnapshot().agents.get(executionId);
    if (!execution || controller.commands.get(executionId).cancelling) {
      return;
    }
    controller.commands.update(executionId, {
      cancellation: controller.commands.get(executionId).cancellation + 1,
      cancelling: true,
    });
    await withTaskCleanup(
      async () => {
        try {
          await execution.cancel();
        } catch {
          controller.commands.update(executionId, {
            failure: new Error(
              "Cancellation failed. Reconnect to check the response."
            ),
          });
        }
      },
      () => {
        controller.commands.update(executionId, { cancelling: false });
      }
    );
  };
  const cancel = async (): Promise<void> => {
    await cancelExecution(conversationId);
  };
  const handleEditSubmit = fork.submit;
  const statusLabel = conversationStatus(
    agent.status,
    busy,
    hasApproval,
    cancelPending
  );
  const actionLocks = conversationActionLocks({
    busy,
    commandPending,
    cancelPending,
    hasApproval,
    pendingMessage,
    fork,
    snapshotError: snapshot.error,
    editingMessageId,
  });
  return (
    <EveArtifactLayout
      replaying={agent.status === "resuming"}
      onStopExecution={cancelExecution}
      logicalChatId={controller.chatId}
      getExecutionMessages={(id) =>
        snapshot.agents.get(id)?.data.messages ?? []
      }
      isExecutionBusy={(id) => {
        const status = snapshot.agents.get(id)?.status;
        return isExecutionBusy(status);
      }}
      conversationId={conversationId}
      documentActionsDisabled={actionLocks.document}
      messages={agent.data.messages}
      onDocumentAction={async ({ message, modelId }) => {
        await run(async () => {
          await submitMessage(message, [], modelId, false);
        });
      }}
    >
      <section className="flex h-full min-h-0 flex-col">
        {header}
        <div className="flex min-h-0 flex-1 flex-col">
          <MessageScrollerProvider autoScroll key={conversationId}>
            <MessageScroller className="flex-1">
              <MessageScrollerViewport preserveScrollOnPrepend>
                <MessageScrollerContent className="mx-auto w-full max-w-3xl p-4">
                  {initialMessage !== undefined &&
                    initialMessage !== "" &&
                    messages.length === 0 && (
                      <MessageScrollerItem
                        messageId="initial-message"
                        scrollAnchor
                      >
                        <EveInitialMessage message={initialMessage} />
                      </MessageScrollerItem>
                    )}
                  <EveMessages
                    actionsDisabled={actionLocks.transcript}
                    conversationId={conversationId}
                    disabled={busy || commandPending}
                    inputDisabled={isInputResponseDisabled(
                      agent.status,
                      commandPending
                    )}
                    isReadonly={false}
                    messages={messages}

                    editor={
                      hasText(editingMessageId)
                        ? {
                            content: (
                              <EveConversationEditor
                                fork={fork}
                                busy={busy}
                                commandPending={commandPending}
                                hasApproval={hasApproval}
                                pendingMessage={pendingMessage}
                                onSubmit={() => {
                                  const completion = handleEditSubmit();
                                  startEventAction(async () => {
                                    await completion;
                                  });
                                }}
                              />
                            ),
                            disabled: fork.busy || Boolean(fork.pending),
                            messageId: editingMessageId,
                            onCancel: fork.cancelEdit,
                          }
                        : undefined
                    }
                    modelForMessage={modelForMessage}
                    renderVersions={(message): React.JSX.Element => (
                      <EveLogicalVersions
                        conversationId={conversationId}
                        messageId={message.id}
                        disabled={actionLocks.navigation}
                      />
                    )}
                    renderResponses={(message): React.JSX.Element => (
                      <EveLogicalResponses
                        conversationId={conversationId}
                        messageId={message.id}
                        disabled={actionLocks.navigation}
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
                      const group = hasText(logicalId)
                        ? logicalResponseSlots(snapshot, logicalId)
                        : undefined;
                      const groupModels: Record<string, number> = {};
                      for (const slot of group?.slots ?? []) {
                        groupModels[slot.modelId] =
                          (groupModels[slot.modelId] ?? 0) + 1;
                      }
                      const completion = fork.begin(message, undefined, {
                        events: agent.events,
                        modelSelection: group ? groupModels : undefined,
                        response:
                          response && hasText(modelForMessage(response))
                            ? response
                            : undefined,
                      });
                      startEventAction(async () => {
                        await completion;
                      });
                    }}

                    onRegenerate={(message, response) => {
                      void fork.begin(message, {
                        events: agent.events,
                        response,
                      });
                    }}

                    suggestions={
                      <PluginSuggestions
                        conversationId={conversationId}
                        events={agent.events}
                        lastMessage={lastMessage}
                        disabled={actionLocks.transcript}
                        onSelect={(suggestion) => {
                          void run(async () => {
                            await (modelIds.length > 1
                              ? fork.compare(
                                  draftMessage(suggestion, []),
                                  modelIds,
                                  composerDraft.selectedTool ?? undefined,
                                  false
                                )
                              : submitMessage(
                                  suggestion,
                                  [],
                                  modelIds[0],
                                  false,
                                  composerDraft.selectedTool ?? undefined
                                ));
                          });
                        }}
                      />
                    }

                    respond={(response) => {
                      startEventAction(async () => {
                        await run(async () => {
                          await send(async () => {
                            await agent.respond([response]);
                          });
                        });
                      });
                    }}
                  />
                  <EveThinkingMessage
                    messages={messages}
                    status={agent.status}
                  />
                  {comparison &&
                    shouldAppendEveOptimisticResponseGroup(comparison) && (
                      <MessageScrollerItem
                        messageId={`comparison:${comparison.operationId}`}
                        scrollAnchor
                      >
                        <EveOptimisticResponseGroup operation={comparison} />
                      </MessageScrollerItem>
                    )}
                </MessageScrollerContent>
              </MessageScrollerViewport>
              <MessageScrollerButton />
            </MessageScroller>
          </MessageScrollerProvider>
          <div className="mx-auto w-full max-w-3xl space-y-3 p-4">
            <EveForkRecovery
              fork={fork}
              showError={!hasText(editingMessageId)}
            />
            <p aria-live="polite" className="sr-only">
              {statusLabel}
            </p>
            {[snapshot.error, displayedError, composerDraft.error]
              .filter(Boolean)
              .map((message): React.JSX.Element => (
                <p key={message} role="alert">
                  {message}
                </p>
              ))}
            {pendingMessage && !commandPending && (
              <EveDeliveryRecovery
                pendingMessage={pendingMessage}
                delivery={delivery}
                composerDraft={composerDraft}
                files={files}
                run={run}
                sendPendingMessage={sendPendingMessage}
                setCommandFailure={setCommandFailure}
              />
            )}
            <EveConversationComposer
              input={input}
              pendingMessage={pendingMessage}
              status={agent.status}
              busy={busy}
              commandPending={commandPending}
              cancelPending={cancelPending}
              hasApproval={hasApproval}
              displayedError={displayedError}
              commandFailure={commandFailure}
              agentError={agent.error}
              onStop={() => {
                startEventAction(cancel);
              }}

              onSubmit={() => {
                void run(async () => {
                  await (modelIds.length > 1
                    ? fork.compare(
                        draftMessage(draft, files.attachments),
                        modelIds,
                        composerDraft.selectedTool ?? undefined
                      )
                    : submitMessage(
                        draft,
                        files.attachments,
                        modelIds[0],
                        true,
                        composerDraft.selectedTool ?? undefined
                      ));
                });
              }}
              onReconnect={() => {
                void run(agent.resume);
              }}
            />
          </div>
        </div>
      </section>
    </EveArtifactLayout>
  );
};

export { EveConversation };
