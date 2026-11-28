"use client";
import { SessionNotActiveError } from "eve/client";
import {
  activeTurn,
  failure,
  openInteractions,
  session,
  turn,
  turns,
} from "eve/events";
import type { Answer, SessionView } from "eve/events";

import { useEveDeliveryReceipt } from "./use-eve-delivery-receipt";

import { ChatSuggestions, MessageResponses } from "@/components/chat-slots";
import { submitTurn } from "@/chatjs/generated/installed-submit-turn";
import { TurnModelPicker } from "@/integrations/chat/model-picker";
import {
  selectedModelIds,
  PendingResponseCards,
  editSelection,
} from "@/chatjs/generated/installed-turn-models";
import { useTurnModels } from "./use-turn-models";

import { withTaskCleanup } from "@/components/task-cleanup";

import { hasText } from "@/components/text-value";

import type { useEveAgent } from "eve/react";
import type { JSX as ReactJSX, ReactNode } from "react";
import React from "react";

import { AttachmentList } from "@/components/attachment-list";
import { Button } from "@/components/ui/button";
import { MessageScrollerItem } from "@/components/ui/message-scroller";
import type { UiToolName } from "@/lib/ai/types";
import { isEveAdmissionBusy } from "@/lib/eve/admission-retry";
import { isEveCommandRejection } from "@/lib/eve/command-rejection";
import type { DraftAttachment } from "@/lib/eve/draft";
import { draftMessage, restoreDraft } from "@/lib/eve/draft";
import type {
  LogicalChat,
  LogicalChatSnapshot,
  NativeChatAgent,
} from "@/lib/eve/logical-chat";
import type { ActivePendingEveMessage } from "@/lib/eve/message-delivery";
import { EVE_MESSAGE_OPERATION_HEADER } from "@/lib/eve/message-delivery";
import type { ReadonlyEveMessage } from "@/lib/eve/readonly-message-types";
import {
  activeResponseModel,
  responseModelReferences,
  selectableResponseModel,
} from "@/lib/eve/response-model";
import { sendCommand } from "@/lib/eve/send-command";

import { ChatConversationScreen } from "../chat/chat-conversation-screen";
import { ChatMessageEditor } from "../chat/chat-message-editor";
import { EveChatError } from "./eve-chat-error";
import { EveComposer } from "./eve-composer";
import { EveForkRecovery } from "./eve-fork-recovery";
import { EveInitialMessage } from "./eve-initial-message";
import { useLogicalChat } from "./eve-logical-context";
import { EveLogicalVersions } from "./eve-logical-navigation";
import { useEveAttachments } from "./use-eve-attachments";
import { useEveComposerDraft } from "./use-eve-composer-draft";
import { useEveFork } from "./use-eve-fork";
import { useEveMessageDelivery } from "./use-eve-message-delivery";
import { useLogicalCommands } from "./use-logical-commands";

const composerStatus = (
  status: string,
  turnOpen = false
): "submitted" | "streaming" | "ready" => {
  if (status === "resuming") {
    return "submitted";
  }
  if (status === "busy" || turnOpen) {
    return "streaming";
  }
  return "ready";
};

const isInactive = (error: Error | undefined): boolean =>
  SessionNotActiveError.is(error) && error.code === "session_not_active";

const conversationError = (
  view: SessionView,
  commandError: Error | undefined,
  agentError: Error | undefined
): { title: string; message: string; reconnect?: true } | undefined => {
  if (isInactive(commandError) || isInactive(agentError)) {
    return {
      title: "Conversation ended",
      message: "Start a new chat to continue.",
    };
  }
  if (isEveCommandRejection(commandError)) {
    return { title: "Request rejected", message: commandError.message };
  }
  const currentError = commandError ?? agentError;
  const latestTurn = turns(view).at(-1);
  const replyFailure =
    latestTurn?.status === "running"
      ? undefined
      : failure(view, latestTurn?.turnId);
  // Eve projects a failed reply into agent.error using its code and message.
  if (
    replyFailure &&
    (!currentError ||
      (currentError.name === replyFailure.code &&
        currentError.message === replyFailure.message))
  ) {
    return {
      title: "Reply interrupted",
      message: "Try sending your message again.",
    };
  }
  if (currentError) {
    return {
      title: "Connection interrupted",
      message: "You may be missing the latest reply.",
      reconnect: true,
    };
  }
  return undefined;
};

const EveConversationError = ({
  error,
  reconnect,
  reconnectDisabled,
}: {
  readonly error: ReturnType<typeof conversationError>;
  readonly reconnect: () => void;
  readonly reconnectDisabled: boolean;
}): ReactJSX.Element | null => {
  if (!error) {
    return null;
  }
  return (
    <EveChatError title={error.title} message={error.message}>
      {error.reconnect === true ? (
        <Button
          disabled={reconnectDisabled}
          onClick={reconnect}
          size="sm"
          type="button"
          variant="outline"
        >
          Reconnect
        </Button>
      ) : undefined}
    </EveChatError>
  );
};

const interactionControls = (
  agent: Pick<NativeChatAgent, "view" | "error" | "status">,
  commandFailure: Error | undefined,
  cancelPending: boolean
) => {
  const { view, status, error } = agent;
  const sessionEnded =
    session(view).status === "ended" ||
    isInactive(error) ||
    isInactive(commandFailure);
  return {
    turnOpen: !sessionEnded && activeTurn(view) !== undefined,
    hasApproval:
      !sessionEnded &&
      openInteractions(view).some(
        ({ turnId }) => turn(view, turnId)?.outcome !== "cancelled"
      ),
    inputDisabled: status === "resuming" || cancelPending || sessionEnded,
  };
};

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
  branchId: string,
  draftScopeId?: string
) => {
  const models = useTurnModels(selectedModelIds);
  const composerDraft = useEveComposerDraft(ownerId, draftScopeId ?? branchId);
  const files = useEveAttachments(composerDraft);
  const fork = useEveFork(ownerId, branchId, (message, selectedTool) => {
    const sent = restoreDraft(message);
    if (
      sameComposerDraft(composerDraft, sent) &&
      composerDraft.selectedTool === (selectedTool ?? null)
    ) {
      composerDraft.setText("");
      files.setAttachments([]);
      composerDraft.setSelectedTool(null);
    }
  });
  const comparison =
    fork.pending && "modelIds" in fork.pending ? fork.pending : undefined;

  return {
    comparison,
    composerDraft,
    files,
    fork,
    ...models,
  };
};

const composerModelIds = (
  selected: readonly string[],
  retained: readonly string[] | undefined,
  visibleModelId: string | undefined
): readonly string[] =>
  hasText(visibleModelId) ? [visibleModelId] : (retained ?? selected);

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

const isExecutionBusy = (status: string | undefined): boolean =>
  status === "busy" || status === "resuming";

const selectedConversationMessages = (
  messages: readonly ReadonlyEveMessage[],
  controller: Readonly<Pick<LogicalChat, "logicalId">>,
  snapshot: Readonly<Pick<LogicalChatSnapshot, "cursorId" | "nodes">>,
  branchId: string
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
      const logicalId = controller.logicalId(branchId, message.id);
      return (
        !hasText(snapshot.cursorId) ||
        (hasText(logicalId) && selectedPath.has(logicalId))
      );
    })
    .map((message) => {
      const id = controller.logicalId(branchId, message.id);
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
    <ChatMessageEditor
      error={fork.error}
      composer={
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
          capabilities={{
            files: fork.files,
            selectedTool: fork.selectedTool,
            onToolChange: handleEditToolChange,
          }}
          modelIds={selectedModelIds(fork.modelSelection.value)}
          modelPicker={<TurnModelPicker {...fork.modelSelection} />}
          onDraftChange={handleEditDraft}
          onSubmit={onSubmit}
        />
      }
    />
  );
};

const EveDeliveryRecovery = ({
  pendingMessage,
  delivery,
  composerDraft,
  files,
  run,
  sendPendingMessage,
  reconnect,
  reconnectDisabled,
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
  readonly reconnect: () => void;
  readonly reconnectDisabled: boolean;
  readonly setCommandFailure: (failure?: Error) => void;
}): ReactJSX.Element => {
  const { rejection } = pendingMessage;
  const rejected = hasText(rejection);
  const message = rejected
    ? rejection
    : "Your draft is saved in this tab. Sending it again may create a duplicate.";
  return (
    <EveChatError
      title={rejected ? "Message not sent" : "Message delivery is unconfirmed"}
      message={
        rejected && pendingMessage.retryable === true
          ? "Chat is temporarily busy. Try sending again."
          : message
      }
    >
      <div className="text-foreground space-y-2">
        {hasText(pendingMessage.message) && (
          <p className="line-clamp-2 wrap-anywhere whitespace-pre-wrap">
            {pendingMessage.message}
          </p>
        )}
        <AttachmentList
          attachments={pendingMessage.attachments}
          variant="pill"
        />
        <div className="flex flex-wrap gap-2">
          {!rejected && (
            <Button
              disabled={reconnectDisabled}
              onClick={reconnect}
              size="sm"
              type="button"
              variant="outline"
            >
              Reconnect
            </Button>
          )}
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
                  (file) =>
                    !current.some((existing) => existing.url === file.url)
                ),
              ]);
              composerDraft.setSelectedTool(
                pendingMessage.selectedTool ?? null
              );
              delivery.release(pendingMessage);
              setCommandFailure();
            }}
            size="sm"
            type="button"
            variant="ghost"
          >
            Restore draft
          </Button>
        </div>
      </div>
    </EveChatError>
  );
};

const conversationActionLocks = ({
  busy,
  commandPending,
  hasApproval,
  pendingMessage,
  fork,
  snapshotError,
  editingMessageId,
}: {
  readonly busy: boolean;
  readonly commandPending: boolean;
  readonly hasApproval: boolean;
  readonly pendingMessage: ReturnType<typeof useEveMessageDelivery>["pending"];
  readonly fork: ReturnType<typeof useConversationInput>["fork"];
  readonly snapshotError: string | undefined;
  readonly editingMessageId: string | undefined;
}) => ({
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
  turnOpen,
  activeModelId,
  busy,
  commandPending,
  cancelPending,
  onStop,
  onSubmit,
}: {
  readonly input: ReturnType<typeof useConversationInput>;
  readonly pendingMessage: ReturnType<typeof useEveMessageDelivery>["pending"];
  readonly status: ReturnType<typeof useEveAgent>["status"];
  readonly turnOpen: boolean;
  readonly activeModelId: string | undefined;
  readonly busy: boolean;
  readonly commandPending: boolean;
  readonly cancelPending: boolean;
  readonly onStop: () => void;
  readonly onSubmit: () => void;
}): ReactJSX.Element => {
  const { composerDraft, files, modelSelection, comparison, fork } = input;
  const statusForComposer = composerStatus(status, turnOpen);
  const steering = statusForComposer === "streaming";
  const visibleModelId = steering ? activeModelId : pendingMessage?.modelId;
  const handleSelectedToolChange = composerDraft.setSelectedTool;
  const handleDraftChange = composerDraft.setText;
  return (
    <EveComposer
      status={statusForComposer}
      allowSendWhileStreaming
      disabled={
        !composerDraft.loaded ||
        (busy && !steering) ||
        commandPending ||
        cancelPending ||
        Boolean(pendingMessage) ||
        fork.locked
      }
      draft={composerDraft.text}
      capabilities={{
        files,
        onToolChange: handleSelectedToolChange,
        turnOptionsLocked: statusForComposer !== "ready",
        attachmentModelPending: steering && !hasText(activeModelId),
        selectedTool: retainedToolSelection(
          comparison,
          pendingMessage,
          composerDraft.selectedTool
        ),
      }}
      modelIds={composerModelIds(
        input.modelIds,
        comparison?.modelIds,
        visibleModelId
      )}
      modelPicker={
        <TurnModelPicker
          disabled={Boolean(pendingMessage)}
          {...modelSelection}
          retainedModelId={visibleModelId}
          retainedModelIds={comparison?.modelIds}
        />
      }
      onDraftChange={handleDraftChange}
      onStop={onStop}
      onSubmit={onSubmit}
      readOnly={Boolean(comparison)}
      stopDisabled={cancelPending || status === "resuming"}
    />
  );
};

const PendingFork = ({
  operation,
}: {
  readonly operation: ReturnType<typeof useConversationInput>["comparison"];
}): React.JSX.Element | null => {
  if (!operation || operation.forkKind === "edit") {
    return null;
  }
  return (
    <MessageScrollerItem
      messageId={`comparison:${operation.operationId}`}
      scrollAnchor
    >
      <EveInitialMessage
        message={operation.message}
        responses={<PendingResponseCards operation={operation} />}
      />
    </MessageScrollerItem>
  );
};

// This controller coordinates streaming, optimistic delivery, recovery, and comparison state.

const EveConversation = ({
  sessionId,
  branchId,
  ownerId,
  header,
  draftScopeId,
  initialMessage,
}: {
  sessionId: string;
  branchId: string;
  ownerId: string;
  header: ReactNode;
  readonly initialMessage?: Parameters<typeof restoreDraft>[0];
  draftScopeId?: string;
}): ReactJSX.Element => {
  const [, startEventAction] = React.useTransition();
  const input = useConversationInput(ownerId, branchId, draftScopeId);
  const { fork, composerDraft, files, comparison, modelIds } = input;
  const handleContinuationModelChange = input.setTurnSelection;
  const delivery = useEveMessageDelivery(sessionId);
  const pendingMessage = delivery.pending;
  const { controller, snapshot } = useLogicalChat();
  const command = useLogicalCommands(controller.commands, branchId);
  const commandFailure = command.failure;
  const commandPending = command.pending;
  const cancelPending = command.cancelling;
  const setCommandFailure = (error?: Error): void => {
    controller.commands.update(branchId, { failure: error });
  };
  const { text: draft, setText: setDraft } = composerDraft;
  const agent = snapshot.agents.get(branchId);
  if (!agent) {
    throw new Error("Native observer is not ready.");
  }
  const refreshDeliveryReceipt = useEveDeliveryReceipt(
    sessionId,
    pendingMessage,
    delivery.accept
  );
  const displayedError =
    pendingMessage || commandPending
      ? undefined
      : conversationError(agent.view, commandFailure, agent.error);
  // Failed provisional messages are retained in the recovery panel below.
  // They must not look like accepted transcript entries or survive a retry twice.
  const messages = selectedConversationMessages(
    agent.messages,
    controller,
    snapshot,
    branchId
  );
  const lastMessage = messages.at(-1);
  const editingMessageId =
    fork.editingMessageId ??
    messages.find((message) => message.id === fork.editingBoundary)?.id;
  const responseModels = responseModelReferences(agent.events);
  const activeModelId = activeResponseModel(agent.view, responseModels);
  const modelForMessage = (
    message: Readonly<Pick<(typeof messages)[number], "metadata">>
  ): string | undefined =>
    selectableResponseModel(responseModels, message.metadata);
  const busy = isExecutionBusy(agent.status);
  const { hasApproval, inputDisabled, turnOpen } = interactionControls(
    agent,
    commandFailure,
    cancelPending
  );
  const steering = composerStatus(agent.status, turnOpen) === "streaming";
  const respond = async (response: Answer): Promise<void> => {
    if (inputDisabled) {
      return;
    }
    setCommandFailure(undefined);
    try {
      await agent.respond([response]);
    } catch (error) {
      setCommandFailure(
        error instanceof Error
          ? error
          : new Error("Could not submit your response.")
      );
    }
  };
  const run = async (action: () => Promise<unknown>): Promise<void> => {
    if (!controller.commands.claim(branchId)) {
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
        controller.commands.update(branchId, { pending: false });
      }
    );
  };
  const send = async (
    action: () => Promise<void>,
    operationId?: string
  ): Promise<void> => {
    const { cancellation } = controller.commands.get(branchId);
    await sendCommand(
      action,
      agent.resume,
      cancellation > 0,
      () => controller.getSnapshot().agents.get(branchId)?.error,
      () => !hasText(operationId) || delivery.hasAcknowledged(operationId)
    );
    if (controller.commands.get(branchId).cancellation === cancellation) {
      controller.commands.update(branchId, { cancellation: 0 });
    }
  };
  const reconnect = (): void => {
    void run(async () => {
      await agent.resume();
      if (hasText(pendingMessage?.operationId)) {
        await refreshDeliveryReceipt(pendingMessage.operationId);
      }
    });
  };
  const sendPendingMessage = async (
    pending: ActivePendingEveMessage
  ): Promise<void> => {
    try {
      await send(async () => {
        await agent.send(draftMessage(pending.message, pending.attachments), {
          turnPolicy: pending.turnPolicy,
          headers: {
            [EVE_MESSAGE_OPERATION_HEADER]: pending.operationId,
            ...(hasText(pending.modelId)
              ? { "x-chatjs-selected-model": pending.modelId }
              : {}),
            ...(pending.selectedTool !== undefined &&
            pending.selectedTool !== null
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
  const submitDraft = async (
    message: string,
    attachments: readonly Readonly<DraftAttachment>[],
    clearComposer: boolean,
    steer = false
  ): Promise<void> => {
    const selectedTool = composerDraft.selectedTool ?? undefined;
    const sendToSession = async (
      modelId: string,
      turnPolicy?: ActivePendingEveMessage["turnPolicy"]
    ): Promise<void> => {
      controller.selectBranch(branchId);
      const pending = delivery.begin({
        attachments,
        message: message.trim(),
        modelId,
        selectedTool,
        turnPolicy,
      });
      if (clearComposer) {
        setDraft("");
        files.setAttachments([]);
        composerDraft.setSelectedTool(null);
      }
      await sendPendingMessage(pending);
    };
    if (steer) {
      await sendToSession(activeModelId ?? modelIds[0], "steer");
      return;
    }
    await submitTurn(modelIds, {
      sendToSession,
      forkFromHere: async (ids) => {
        await fork.fromHere(
          draftMessage(message, attachments),
          ids,
          selectedTool,
          clearComposer
        );
      },
    });
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
    await cancelExecution(branchId);
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
    hasApproval,
    pendingMessage,
    fork,
    snapshotError: snapshot.error,
    editingMessageId,
  });
  return (
    <ChatConversationScreen
      branchId={branchId}
      header={header}
      transcript={{
        actionsDisabled: actionLocks.transcript,
        branchId,
        disabled: busy || commandPending,
        inputDisabled,
        isReadonly: false,
        messages,
        view: agent.view,
        editor: hasText(editingMessageId)
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
          : undefined,
        modelForMessage,
        renderVersions: (message): React.JSX.Element => (
          <EveLogicalVersions
            branchId={branchId}
            messageId={message.id}
            disabled={actionLocks.navigation}
          />
        ),
        renderResponses: (message): React.JSX.Element => (
          <MessageResponses
            onModelChange={handleContinuationModelChange}
            branchId={branchId}
            messageId={message.id}
            disabled={actionLocks.navigation}
          />
        ),
        messageKey: (message) =>
          controller.logicalId(branchId, message.id) ??
          `${sessionId}:${message.id}`,
        onEdit: (message) => {
          const following = messages.slice(messages.indexOf(message) + 1);
          const nextUser = following.findIndex(
            (candidate) => candidate.role === "user"
          );
          const response = following
            .slice(0, nextUser === -1 ? following.length : nextUser)
            .find((candidate) => candidate.role === "assistant");
          const logicalId = controller.logicalId(branchId, message.id);
          const selection = hasText(logicalId)
            ? editSelection(snapshot, logicalId)
            : undefined;
          const completion = fork.begin(message, undefined, {
            events: agent.events,
            modelSelection: selection,
            response:
              response && hasText(modelForMessage(response))
                ? response
                : undefined,
          });
          startEventAction(async () => {
            await completion;
          });
        },
        onRegenerate: (message, response) => {
          void fork.begin(message, {
            events: agent.events,
            response,
          });
        },
        suggestions: (
          <ChatSuggestions
            sessionId={sessionId}
            branchId={branchId}
            events={agent.events}
            lastMessage={lastMessage}
            disabled={actionLocks.transcript}
            onSelect={(suggestion) => {
              void run(async () => {
                await submitDraft(suggestion, [], false);
              });
            }}
          />
        ),
        respond: (response) => {
          startEventAction(async () => {
            await respond(response);
          });
        },
      }}
      status={composerStatus(agent.status)}
      leading={
        initialMessage !== undefined &&
        initialMessage !== "" &&
        messages.length === 0 && (
          <MessageScrollerItem messageId="initial-message" scrollAnchor>
            <EveInitialMessage message={initialMessage} />
          </MessageScrollerItem>
        )
      }
      trailing={<PendingFork operation={comparison} />}
      notices={
        <>
          <EveForkRecovery fork={fork} showError={!hasText(editingMessageId)} />
          <p aria-live="polite" className="sr-only">
            {statusLabel}
          </p>
          {hasText(snapshot.error) && (
            <EveChatError
              title="Couldn’t load all messages"
              message="Refresh the page to try again."
            />
          )}
          <EveConversationError
            error={displayedError}
            reconnect={reconnect}
            reconnectDisabled={busy || cancelPending}
          />
          {hasText(composerDraft.error) && (
            <EveChatError
              title="Draft unavailable"
              message={composerDraft.error}
            />
          )}
          {pendingMessage && !commandPending && (
            <EveDeliveryRecovery
              pendingMessage={pendingMessage}
              delivery={delivery}
              composerDraft={composerDraft}
              files={files}
              run={run}
              sendPendingMessage={sendPendingMessage}
              reconnect={reconnect}
              reconnectDisabled={busy || cancelPending}
              setCommandFailure={setCommandFailure}
            />
          )}
        </>
      }
      composer={
        <EveConversationComposer
          input={input}
          pendingMessage={pendingMessage}
          status={agent.status}
          turnOpen={turnOpen}
          activeModelId={activeModelId}
          busy={busy}
          commandPending={commandPending}
          cancelPending={cancelPending}
          onStop={() => {
            startEventAction(cancel);
          }}

          onSubmit={() => {
            void run(async () => {
              await submitDraft(draft, files.attachments, true, steering);
            });
          }}
        />
      }
    />
  );
};

export { EveConversation };
