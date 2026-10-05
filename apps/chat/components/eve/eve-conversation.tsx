"use client";

import type { useEveAgent } from "eve/react";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import React, { useEffect, useState } from "react";
/* oxlint-enable sort-imports */
import type { JSX as ReactJSX, ReactNode } from "react";

/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
/* oxlint-enable sort-imports */
import { AttachmentList } from "@/components/attachment-list";
import { Button } from "@/components/ui/button";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { SelectedModelValue, UiToolName } from "@/lib/ai/types";
/* oxlint-enable sort-imports */
import {
  expandSelectedModelValue,
  getPrimarySelectedModelId,
} from "@/lib/ai/types";
import { isEveAdmissionBusy } from "@/lib/eve/admission-retry";
import { isEveCommandRejection } from "@/lib/eve/command-rejection";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { draftMessage, restoreDraft } from "@/lib/eve/draft";
/* oxlint-enable sort-imports */
import type { DraftAttachment } from "@/lib/eve/draft";
import { eveUserForkBoundary } from "@/lib/eve/fork-source";
/* oxlint-disable import/max-dependencies -- @/lib/eve/logical-response-slots import: import/max-dependencies: these direct dependencies compose this feature without hiding imports behind a barrel. */
import { logicalResponseSlots } from "@/lib/eve/logical-response-slots";
/* oxlint-enable import/max-dependencies */
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { ActivePendingEveMessage } from "@/lib/eve/message-delivery";
/* oxlint-enable sort-imports */
import { EVE_MESSAGE_OPERATION_HEADER } from "@/lib/eve/message-delivery";
import type { EveMessageInput } from "@/lib/eve/message-input";
import { responseModelReferences } from "@/lib/eve/response-model";
import { sendCommand } from "@/lib/eve/send-command";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  useDefaultModel,
  useModelChange,
} from "@/providers/default-model-provider";
/* oxlint-enable sort-imports */

import { EveArtifactLayout } from "./eve-artifact-layout";
import { EveComposer } from "./eve-composer";
import { EveForkRecovery } from "./eve-fork-recovery";
import { EveInitialMessage } from "./eve-initial-message";
import { useLogicalChat } from "./eve-logical-context";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  EveLogicalResponses,
  EveLogicalVersions,
} from "./eve-logical-navigation";
/* oxlint-enable sort-imports */
import { EveMessages } from "./eve-messages";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  EveOptimisticResponseGroup,
  shouldAppendEveOptimisticResponseGroup,
} from "./eve-optimistic-response-group";
/* oxlint-enable sort-imports */
import { EveThinkingMessage } from "./eve-thinking-message";
import { useEveAttachments } from "./use-eve-attachments";
import { useEveComposerDraft } from "./use-eve-composer-draft";
import { useEveFork } from "./use-eve-fork";
import { useEveMessageDelivery } from "./use-eve-message-delivery";
import { useLogicalCommands } from "./use-logical-commands";
/* oxlint-disable max-lines-per-function, max-params, max-statements, no-magic-numbers, no-undefined, react-perf/jsx-no-new-array-as-prop, react-perf/jsx-no-new-function-as-prop, react-perf/jsx-no-new-object-as-prop, react/jsx-max-depth, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, typescript/strict-boolean-expressions, typescript/strict-void-return, unicorn/no-null -- EveConversation: max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; max-params: this callback signature is consumed by the existing library or feature API; max-statements: the ordered state transitions and rendering guards belong to this cohesive feature operation; no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including -1); no-undefined: undefined preserves the optional prop, cache, or missing-value contract; null is a different value; react-perf/jsx-no-new-array-as-prop: these props derive from the current render; sharing or memoizing them requires a separate identity contract; react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; react-perf/jsx-no-new-object-as-prop: this prop object derives from current render state or feature styling; hoisting changes its ownership; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including failure?: Error); typescript/promise-function-async: return the existing promise directly; adding async changes synchronous throw behavior and promise identity; typescript/strict-boolean-expressions: the existing empty, missing, or optional value deliberately selects this feature fallback (including snapshot.cursorId); typescript/strict-void-return: this library event API ignores the return value while the existing handler owns its async pending and error lifecycle; unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

// This controller coordinates streaming, optimistic delivery, recovery, and comparison state.
// oxlint-disable-next-line eslint/complexity -- Review debt #620: split this state/render orchestration only after verifying its pending, recovery and failure transitions.
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
  initialMessage?: EveMessageInput;
  draftScopeId?: string;
}): ReactJSX.Element => {
  const {
    fork,
    composerDraft,
    files,
    comparison,
    modelSelection,
    modelIds,
    // oxlint-disable-next-line eslint/no-use-before-define -- Review debt #620: useConversationInput is hoisted; review declaration placement while preserving the composer/fork lifecycle.
  } = useConversationInput(ownerId, conversationId, draftScopeId);
  const delivery = useEveMessageDelivery(sessionId);
  const pendingMessage = delivery.pending;
  const { controller, snapshot } = useLogicalChat();
  const command = useLogicalCommands(controller.commands, conversationId);
  const commandFailure = command.failure;
  const commandPending = command.pending;
  const cancelPending = command.cancelling;
  const setCommandFailure = (failure?: Error): void =>
    controller.commands.update(conversationId, { failure });
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
      return (
        !snapshot.cursorId || Boolean(logicalId && selectedPath.has(logicalId))
      );
    })
    // oxlint-disable-next-line oxc/no-map-spread -- #541: Merge canonical message metadata into a view without mutating runtime message snapshots.
    .map((message) => {
      const id = controller.logicalId(conversationId, message.id);
      const canonical =
        typeof id === "string" && id !== ""
          ? snapshot.nodes.get(id)?.message
          : undefined;
      return canonical ? { ...message, parts: canonical.parts } : message;
    });
  const editingMessageId =
    fork.editingMessageId ??
    messages.find(
      (message) =>
        eveUserForkBoundary(message) === fork.editingBoundary &&
        Boolean(fork.editingBoundary)
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
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve run's awaited sequencing and rejected-Promise behavior. */
  const run = async (action: () => Promise<unknown>): Promise<void> => {
    if (!controller.commands.claim(conversationId)) {
      return;
    }
    setCommandFailure(undefined);

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
  /* oxlint-enable oxc/no-async-await */
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve send's awaited sequencing and rejected-Promise behavior. */
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
      () => !operationId || delivery.hasAcknowledged(operationId)
    );
    if (controller.commands.get(conversationId).cancellation === cancellation) {
      controller.commands.update(conversationId, { cancellation: 0 });
    }
  };
  /* oxlint-enable oxc/no-async-await */
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve sendPendingMessage's awaited sequencing and rejected-Promise behavior. */
  const sendPendingMessage = async (
    pending: ActivePendingEveMessage
  ): Promise<void> => {
    try {
      await send(
        () =>
          agent.send(draftMessage(pending.message, pending.attachments), {
            headers: {
              [EVE_MESSAGE_OPERATION_HEADER]: pending.operationId,
              ...(pending.modelId
                ? { "x-chatjs-selected-model": pending.modelId }
                : {}),
              ...(pending.selectedTool
                ? { "x-chatjs-selected-tool": pending.selectedTool }
                : {}),
            },
          }),
        pending.operationId
      );
    } catch (error) {
      if (isEveCommandRejection(error)) {
        delivery.reject(pending, error.message, isEveAdmissionBusy(error));
      }
      throw error;
    }
  };
  /* oxlint-enable oxc/no-async-await */
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve submitMessage's awaited sequencing and rejected-Promise behavior. */
  const submitMessage = async (
    message: string,
    attachments: DraftAttachment[],
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
  /* oxlint-enable oxc/no-async-await */
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve cancelExecution's awaited sequencing and rejected-Promise behavior. */
  const cancelExecution = async (executionId: string): Promise<void> => {
    const execution = controller.getSnapshot().agents.get(executionId);
    if (!execution || controller.commands.get(executionId).cancelling) {
      return;
    }
    controller.commands.update(executionId, {
      cancellation: controller.commands.get(executionId).cancellation + 1,
      cancelling: true,
    });
    try {
      await execution.cancel();
    } catch {
      controller.commands.update(executionId, {
        failure: new Error(
          "Cancellation failed. Reconnect to check the response."
        ),
      });
      // oxlint-disable-next-line react/todo -- React Compiler cannot analyze required cancellation cleanup in finally.
    } finally {
      controller.commands.update(executionId, { cancelling: false });
    }
  };
  /* oxlint-enable oxc/no-async-await */
  const cancel = (): Promise<void> => cancelExecution(conversationId);
  // Retain the selected tool across a pending or comparison recovery flow.
  // oxlint-disable-next-line eslint/no-use-before-define -- Review debt #620: retainedToolSelection is a hoisted function; review declaration placement without changing selection recovery behavior.
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
    statusLabel = "Loading conversation";
  }
  if (hasApproval) {
    statusLabel = "Waiting for your input";
  }
  if (cancelPending) {
    statusLabel = "Stopping…";
  }
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
        return (
          status === "submitted" ||
          status === "streaming" ||
          status === "resuming"
        );
      }}
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
            <ConversationContent
              // oxlint-disable-next-line react/forbid-component-props -- ConversationContent accepts className in its styling contract; preserve this caller's layout and appearance.
              className="mx-auto w-full max-w-3xl"
            >
              {initialMessage && messages.length === 0 && (
                <EveInitialMessage message={initialMessage} />
              )}
              <EveMessages
                actionsDisabled={
                  busy ||
                  commandPending ||
                  fork.locked ||
                  !fork.family.data ||
                  Boolean(snapshot.error) ||
                  hasApproval ||
                  Boolean(pendingMessage)
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
                              // oxlint-disable-next-line jsx-a11y/no-autofocus -- #536: Choosing Edit intentionally transfers focus to the message composer inside that message.
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
                              // oxlint-disable-next-line typescript/no-misused-promises -- #585: The fork hook owns edit submission errors and pending state.
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
                    disabled={
                      fork.locked ||
                      Boolean(editingMessageId) ||
                      Boolean(pendingMessage)
                    }
                  />
                )}
                renderResponses={(message): React.JSX.Element => (
                  <EveLogicalResponses
                    conversationId={conversationId}
                    messageId={message.id}
                    disabled={
                      fork.locked ||
                      Boolean(editingMessageId) ||
                      Boolean(pendingMessage)
                    }
                  />
                )}
                messageKey={(message) =>
                  controller.logicalId(conversationId, message.id) ??
                  `${sessionId}:${message.id}`
                }

                // oxlint-disable-next-line typescript/no-misused-promises -- #585: Conversation commands run through the existing fork/run/cancellation owners; changing event settlement requires command-lifecycle review.
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

                onRegenerate={(message, response) => {
                  void fork.begin(message, { events: agent.events, response });
                }}

                onSuggestion={(suggestion) => {
                  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve callbacks in this statement's awaited sequencing and rejected-Promise behavior. */
                  void run(async () => {
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
                  });
                  /* oxlint-enable oxc/no-async-await */
                }}

                // oxlint-disable-next-line typescript/no-misused-promises -- #585: Conversation commands run through the existing fork/run/cancellation owners; changing event settlement requires command-lifecycle review.
                respond={(response) =>
                  run(() => send(() => agent.respond([response])))
                }
              />
              <EveThinkingMessage messages={messages} status={agent.status} />
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
              .map((message): React.JSX.Element => (
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
                <div className="flex flex-wrap gap-2">
                  {pendingMessage.retryable && pendingMessage.operationId && (
                    <Button
                      onClick={() => {
                        /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve callbacks in this statement's awaited sequencing and rejected-Promise behavior. */
                        void run(async () => {
                          const retried = delivery.retry(pendingMessage);
                          if (retried) {
                            await sendPendingMessage(retried);
                          }
                        });
                        /* oxlint-enable oxc/no-async-await */
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
                      setDraft((current) =>
                        current
                          ? `${current}\n\n${pendingMessage.message}`
                          : pendingMessage.message
                      );
                      files.setAttachments((current) => [
                        ...current,
                        ...pendingMessage.attachments.filter(
                          (file) =>
                            !current.some(
                              (existing) => existing.url === file.url
                            )
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
                </div>
              </output>
            )}
            <EveComposer
              status={agent.status === "resuming" ? "submitted" : agent.status}
              disabled={
                !composerDraft.loaded ||
                busy ||
                commandPending ||
                cancelPending ||
                hasApproval ||
                Boolean(pendingMessage) ||
                fork.locked
              }
              draft={draft}
              files={files}
              modelSelection={modelSelection}
              onDraftChange={setDraft}

              // oxlint-disable-next-line typescript/no-misused-promises -- #585: Conversation commands run through the existing fork/run/cancellation owners; changing event settlement requires command-lifecycle review.
              onStop={cancel}

              onSubmit={() => {
                /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve callbacks in this statement's awaited sequencing and rejected-Promise behavior. */
                void run(async () => {
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
                });
                /* oxlint-enable oxc/no-async-await */
              }}
              onToolChange={handleSelectedToolChange}
              readOnly={Boolean(comparison)}
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

                  onClick={() => {
                    void run(agent.resume);
                  }}
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
/* oxlint-enable max-lines-per-function, max-params, max-statements, no-magic-numbers, no-undefined, react-perf/jsx-no-new-array-as-prop, react-perf/jsx-no-new-function-as-prop, react-perf/jsx-no-new-object-as-prop, react/jsx-max-depth, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, typescript/strict-boolean-expressions, typescript/strict-void-return, unicorn/no-null */

/* oxlint-disable typescript/prefer-readonly-parameter-types -- sameComposerDraft: typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including draft: ReturnType<typeof restoreDraft>). */

const sameComposerDraft = (
  draft: ReturnType<typeof restoreDraft>,
  sent: ReturnType<typeof restoreDraft>
): boolean =>
  draft.text.trim() === sent.text.trim() &&
  draft.attachments.length === sent.attachments.length &&
  draft.attachments.every(
    (file, index) => file.url === sent.attachments[index]?.url
  );
/* oxlint-enable typescript/prefer-readonly-parameter-types */

/* oxlint-disable no-magic-numbers, typescript/prefer-readonly-parameter-types -- nextTurnBoundary: no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 5); typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

const nextTurnBoundary = (
  event: ReturnType<typeof useEveAgent>["events"][number] | undefined
): string => {
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
/* oxlint-enable no-magic-numbers, typescript/prefer-readonly-parameter-types */

/* oxlint-disable no-undefined, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, unicorn/no-null -- useConversationInput: no-undefined: undefined preserves the optional prop, cache, or missing-value contract; null is a different value; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including message); unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

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

  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve callbacks in this return statement's awaited sequencing and rejected-Promise behavior. */
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
  /* oxlint-enable oxc/no-async-await */
};
/* oxlint-enable no-undefined, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, unicorn/no-null */

/* oxlint-disable typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, unicorn/no-null -- retainedToolSelection: typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including comparison: { selectedTool?: UiToolName } | undefined); unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

const retainedToolSelection = (
  comparison: { selectedTool?: UiToolName } | undefined,
  pending: { selectedTool?: UiToolName } | null,
  draft: UiToolName | null
) => {
  const retained = comparison ?? pending;
  return retained ? (retained.selectedTool ?? null) : draft;
};
/* oxlint-enable typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, unicorn/no-null */

/* oxlint-disable max-lines -- eve-conversation keeps its cohesive feature and related render helpers together; splitting this module requires a separate public-boundary review. This exception covers the file-length metric. */
export { EveConversation };
