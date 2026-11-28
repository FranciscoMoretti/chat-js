"use client";
import { projectCreationScope } from "@/lib/eve/project-creation";
import type { CreationScope } from "@/lib/eve/pending-create";

import { withTaskCleanup } from "@/components/task-cleanup";

import { hasText } from "@/components/text-value";

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createClientSnapshot } from "@/components/client-snapshot";
import type { ComponentProps, SetStateAction } from "react";
import type { ComposerSubmission } from "@/components/composer/submission";
import { TurnModelPicker } from "@/integrations/chat/model-picker";
import {
  PendingResponseCards,
  selectedModelIds,
} from "@/chatjs/generated/installed-turn-models";
import { useTurnModels } from "./use-turn-models";

import { ThinkingMessage } from "@/components/thinking-message";
import type { UiToolName } from "@/lib/ai/types";
import { CreationRejectedError } from "@/lib/eve/create-conversation";
import { draftMessage, restoreDraft } from "@/lib/eve/draft";
import {
  finishCreation,
  prepareSelectedCreation,
  readCreationFollowUp,
  readCreationRequest,
  saveCreationFollowUp,
} from "@/lib/eve/pending-create";
import { resolveCreationRequest } from "@/lib/eve/resolve-creation-request";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";

import type { EveComposer } from "./eve-composer";
import { EveCreationRecovery } from "./eve-creation-recovery";
import { EveInitialMessage } from "./eve-initial-message";
import { useEveRuntime } from "./eve-logical-context";
import { useEveAttachments } from "./use-eve-attachments";

const retainedModels = (
  operation:
    | ReadonlyNativeSurface<ReturnType<typeof prepareSelectedCreation>>
    | undefined,
  selected: readonly string[]
) => {
  if (operation && "modelIds" in operation) {
    return { group: operation, modelIds: operation.modelIds };
  }
  const modelId = operation?.modelId;
  return { modelId, modelIds: hasText(modelId) ? [modelId] : selected };
};

export const useNewEveConversation = ({
  ownerId,
  creationInput,
  onPendingChange,
}: {
  readonly ownerId: string;
  readonly creationInput?: Readonly<{ projectId?: string }>;
  readonly onPendingChange?: (pending: boolean) => void;
}) => {
  const openRuntime = useEveRuntime();
  const scope = useMemo((): CreationScope | undefined => {
    const context = projectCreationScope(creationInput);
    return context ? { context } : undefined;
  }, [creationInput]);
  const { modelIds, modelSelection } = useTurnModels(selectedModelIds);
  const files = useEveAttachments();
  const { setAttachments } = files;
  const [cleanupRejected, setCleanupRejected] = useState(false);
  const [contextRejected, setContextRejected] = useState(false);
  const store = useMemo(
    () =>
      createClientSnapshot<{
        draft: string;
        followUpDraft: string;
        recoveredFollowUp: boolean;
        selectedTool: UiToolName | null;
        operation:
          | ReadonlyNativeSurface<ReturnType<typeof prepareSelectedCreation>>
          | undefined;
        failure: string;
      }>(
        {
          draft: "",
          followUpDraft: "",
          recoveredFollowUp: false,
          selectedTool: null,
          operation: undefined,
          failure: "",
        },
        (current) => {
          try {
            const pending = readCreationRequest(sessionStorage, ownerId, scope);
            const savedFollowUp = readCreationFollowUp(
              sessionStorage,
              ownerId,
              scope
            );
            if (!pending) {
              return {
                ...current,
                draft: savedFollowUp,
                recoveredFollowUp: hasText(savedFollowUp),
              };
            }
            const restored = restoreDraft(pending.message);
            setAttachments(restored.attachments);
            return {
              ...current,
              draft: restored.text,
              followUpDraft: savedFollowUp,
              selectedTool: pending.selectedTool ?? null,
              operation: pending,
            };
          } catch {
            return {
              ...current,
              failure: "The saved draft could not be restored.",
            };
          }
        }
      ),
    [ownerId, scope, setAttachments]
  );
  const {
    draft,
    followUpDraft,
    recoveredFollowUp,
    selectedTool,
    operation: retainedOperation,
    failure,
  } = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot
  );
  const {
    setSelectedTool,

    setFailure,
  } = useMemo(
    () => ({
      setSelectedTool: (value: SetStateAction<UiToolName | null>): void => {
        store.update((current) => ({
          ...current,
          selectedTool:
            typeof value === "function" ? value(current.selectedTool) : value,
        }));
      },
      setFailure: (value: string): void => {
        store.set("failure", value);
      },
    }),
    [store]
  );
  const retained = retainedOperation !== undefined;
  const models = retainedModels(retainedOperation, modelIds);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  useEffect(() => {
    onPendingChange?.(busy || retained);
  }, [busy, retained, onPendingChange]);
  const submit = async (): Promise<void> => {
    if (lock.current) {
      return;
    }
    lock.current = true;
    setBusy(true);
    setFailure("");
    let navigating = false;

    await withTaskCleanup(
      async () => {
        try {
          const operation = prepareSelectedCreation(
            sessionStorage,
            ownerId,
            draftMessage(draft, files.attachments),
            modelIds,
            scope,
            selectedTool ?? undefined,
            creationInput
          );
          store.update((current) => ({
            ...current,
            draft: restoreDraft(operation.message).text,
            selectedTool: operation.selectedTool ?? null,
            operation,
          }));
          if (recoveredFollowUp) {
            saveCreationFollowUp(sessionStorage, ownerId, "", scope);
            store.set("recoveredFollowUp", false);
          }
          const binding = await resolveCreationRequest(
            sessionStorage,
            ownerId,
            operation,
            scope
          );
          await openRuntime({
            ...binding,
            operation,
            ownerId,
            getFollowUpDraft: () => store.getSnapshot().followUpDraft,
          });
          navigating = true;
          saveCreationFollowUp(sessionStorage, ownerId, "", scope);
        } catch (error) {
          if (
            error instanceof CreationRejectedError &&
            error.code === "project_not_found" &&
            scope?.context !== undefined
          ) {
            setContextRejected(true);
          } else if (error instanceof CreationRejectedError) {
            try {
              finishCreation(sessionStorage, ownerId, scope);
              store.set("operation", undefined);
            } catch {
              setCleanupRejected(true);
              setFailure(
                "The rejected request could not be cleared. Keep this tab for recovery."
              );
              return;
            }
          }
          setFailure(
            error instanceof Error
              ? error.message
              : "Unable to start. Retain this operation before retrying."
          );
        }
      },
      () => {
        lock.current = false;
        if (!navigating) {
          setBusy(false);
        }
      }
    );
  };
  const clearRejected = (): void => {
    try {
      finishCreation(sessionStorage, ownerId, scope);
      store.set("operation", undefined);
      setCleanupRejected(false);
      setFailure("");
    } catch {
      setFailure(
        "The rejected request could not be cleared. Keep this tab for recovery."
      );
    }
  };
  const recovery =
    contextRejected || (retained && !busy) ? (
      <EveCreationRecovery
        firstMessage={draft}
        initiallyRejected={contextRejected || cleanupRejected}
        initialFailure={failure}
        onClearRejected={cleanupRejected ? clearRejected : undefined}
        operationId={retainedOperation?.operationId}
        ownerId={ownerId}
        scope={scope}
      />
    ) : undefined;
  const composer = {
    autoFocus: true,
    status: busy ? "submitted" : "ready",
    disabled: busy,
    allowDraftWhileBusy: true,
    draft: busy ? followUpDraft : draft,
    capabilities: {
      files: busy ? { ...files, attachments: [] } : files,
      selectedTool,
      onToolChange: setSelectedTool,
    },
    modelIds: models.modelIds,
    modelPicker: (
      <TurnModelPicker
        {...modelSelection}
        retainedModelId={models.modelId}
        retainedModelIds={models.group?.modelIds}
      />
    ),
    onDraftChange: (value: string) => {
      store.set(busy ? "followUpDraft" : "draft", value);
      if (busy || recoveredFollowUp) {
        try {
          saveCreationFollowUp(sessionStorage, ownerId, value, scope);
        } catch {
          setFailure(
            "Your follow-up draft could not be saved. Keep this tab open."
          );
        }
      }
    },
    readOnly: retained && !busy,
  } satisfies Omit<ComponentProps<typeof EveComposer>, "onSubmit">;
  return {
    contextual: scope?.context !== undefined,
    composer,
    submission: {
      submit,
      pending: busy,
      error: failure,
      recovery,
      preview:
        busy &&
        (models.group ? (
          <EveInitialMessage
            message={models.group.message}
            responses={<PendingResponseCards operation={models.group} />}
          />
        ) : (
          <>
            <EveInitialMessage
              message={draftMessage(draft, files.attachments)}
            />
            <ThinkingMessage />
          </>
        )),
    } satisfies ComposerSubmission,
  };
};
