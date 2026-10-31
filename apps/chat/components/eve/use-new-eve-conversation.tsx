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
import { ParallelResponseModelPicker } from "@/components/parallel-responses/model-picker";

import { ThinkingMessage } from "@/components/thinking-message";
import type { SelectedModelValue, UiToolName } from "@/lib/ai/types";
import {
  expandSelectedModelValue,
  getPrimarySelectedModelId,
} from "@/lib/ai/types";
import { CreationRejectedError } from "@/lib/eve/create-conversation";
import { draftMessage, restoreDraft } from "@/lib/eve/draft";
import {
  finishCreation,
  prepareSelectedCreation,
  readCreationRequest,
} from "@/lib/eve/pending-create";
import { resolveCreationRequest } from "@/lib/eve/resolve-creation-request";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import {
  useDefaultModel,
  useModelChange,
} from "@/providers/default-model-provider";

import type { EveComposer } from "./eve-composer";
import { EveCreationRecovery } from "./eve-creation-recovery";
import { EveInitialMessage } from "./eve-initial-message";
import { useEveRuntime } from "./eve-logical-context";
import { EveOptimisticResponseGroup } from "./eve-optimistic-response-group";
import { useEveAttachments } from "./use-eve-attachments";

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
  const selectedModel = useDefaultModel();
  const changeModel = useModelChange();
  const [selection, setSelection] = useState<SelectedModelValue>();
  const files = useEveAttachments();
  const { setAttachments } = files;
  const [cleanupRejected, setCleanupRejected] = useState(false);
  const [contextRejected, setContextRejected] = useState(false);
  const store = useMemo(
    () =>
      createClientSnapshot<{
        draft: string;
        selectedTool: UiToolName | null;
        retainedOperationId: string | undefined;
        retainedModelId: string | undefined;
        retainedModelIds: readonly string[] | undefined;
        failure: string;
      }>(
        {
          draft: "",
          selectedTool: null,
          retainedOperationId: undefined,
          retainedModelId: undefined,
          retainedModelIds: undefined,
          failure: "",
        },
        (current) => {
          try {
            const pending = readCreationRequest(sessionStorage, ownerId, scope);
            if (!pending) {
              return current;
            }
            const restored = restoreDraft(pending.message);
            setAttachments(restored.attachments);
            return {
              ...current,
              draft: restored.text,
              selectedTool: pending.selectedTool ?? null,
              retainedOperationId: pending.operationId,
              retainedModelIds:
                "modelIds" in pending ? pending.modelIds : undefined,
              retainedModelId:
                "modelIds" in pending ? undefined : pending.modelId,
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
    selectedTool,
    retainedOperationId,
    retainedModelId,
    retainedModelIds,
    failure,
  } = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot
  );
  const {
    setDraft,
    setSelectedTool,
    setRetainedOperationId,
    setRetainedModelId,
    setRetainedModelIds,
    setFailure,
  } = useMemo(
    () => ({
      setDraft: (value: string): void => {
        store.set("draft", value);
      },
      setSelectedTool: (value: SetStateAction<UiToolName | null>): void => {
        store.update((current) => ({
          ...current,
          selectedTool:
            typeof value === "function" ? value(current.selectedTool) : value,
        }));
      },
      setRetainedOperationId: (value: string | undefined): void => {
        store.set("retainedOperationId", value);
      },
      setRetainedModelId: (value: string | undefined): void => {
        store.set("retainedModelId", value);
      },
      setRetainedModelIds: (value: readonly string[] | undefined): void => {
        store.set("retainedModelIds", value);
      },
      setFailure: (value: string): void => {
        store.set("failure", value);
      },
    }),
    [store]
  );
  const retained = retainedOperationId !== undefined;
  const [busy, setBusy] = useState(false);
  const [optimisticComparison, setOptimisticComparison] =
    useState<
      Extract<
        ReadonlyNativeSurface<ReturnType<typeof prepareSelectedCreation>>,
        { readonly modelIds: readonly string[] }
      >
    >();
  const lock = useRef(false);
  useEffect(() => {
    onPendingChange?.(busy || retained);
  }, [busy, retained, onPendingChange]);
  const retainOperation = (
    operation: ReadonlyNativeSurface<ReturnType<typeof prepareSelectedCreation>>
  ): void => {
    setDraft(restoreDraft(operation.message).text);
    setSelectedTool(operation.selectedTool ?? null);
    setRetainedModelId("modelIds" in operation ? undefined : operation.modelId);
    setRetainedModelIds(
      "modelIds" in operation ? operation.modelIds : undefined
    );
    setOptimisticComparison("modelIds" in operation ? operation : undefined);
    setRetainedOperationId(operation.operationId);
  };
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
          const modelIds = expandSelectedModelValue(selection ?? selectedModel);
          const operation = prepareSelectedCreation(
            sessionStorage,
            ownerId,
            draftMessage(draft, files.attachments),
            modelIds,
            scope,
            selectedTool ?? undefined,
            creationInput
          );
          retainOperation(operation);
          const binding = await resolveCreationRequest(
            sessionStorage,
            ownerId,
            operation,
            scope
          );
          await openRuntime({ ...binding, operation, ownerId });
          navigating = true;
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
              setRetainedModelId(undefined);
              setRetainedModelIds(undefined);
              setOptimisticComparison(undefined);
              setRetainedOperationId(undefined);
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
      setRetainedModelId(undefined);
      setRetainedModelIds(undefined);
      setOptimisticComparison(undefined);
      setRetainedOperationId(undefined);
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
        operationId={retainedOperationId}
        ownerId={ownerId}
        scope={scope}
      />
    ) : undefined;
  const composer = {
    autoFocus: true,
    status: busy ? "submitted" : "ready",
    disabled: busy,
    draft: busy ? "" : draft,
    capabilities: {
      files: busy ? { ...files, attachments: [] } : files,
      selectedTool,
      onToolChange: setSelectedTool,
    },
    modelIds:
      retainedModelIds ??
      (hasText(retainedModelId)
        ? [retainedModelId]
        : expandSelectedModelValue(selection ?? selectedModel)),
    modelPicker: (
      <ParallelResponseModelPicker
        modelSelection={{
          onChange: async (value) => {
            setSelection(value);
            const primary = getPrimarySelectedModelId(value);
            if (hasText(primary)) {
              await changeModel(primary);
            }
          },
          value: selection ?? selectedModel,
        }}
        retainedModelId={retainedModelId}
        retainedModelIds={retainedModelIds}
      />
    ),
    onDraftChange: (value: string) => {
      // Clearing the controlled editor must not erase the saved send intent.
      if (!busy) {
        setDraft(value);
      }
    },
    readOnly: retained,
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
        (optimisticComparison ? (
          <EveOptimisticResponseGroup operation={optimisticComparison} />
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
