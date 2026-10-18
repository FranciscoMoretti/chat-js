"use client";

import { withTaskCleanup } from "@/components/task-cleanup";

import { hasText } from "@/components/text-value";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useMemo,
  useRef,
  useState,
  useTransition,
  useSyncExternalStore,
} from "react";
import type { SetStateAction } from "react";
import { createClientSnapshot } from "@/components/client-snapshot";

import type { SelectedModelValue, UiToolName } from "@/lib/ai/types";
import { expandSelectedModelValue, isSelectedModelValue } from "@/lib/ai/types";
import type { EveForkInput } from "@/lib/eve/contracts";
import { CreationRejectedError } from "@/lib/eve/create-conversation";
import type { DraftAttachment } from "@/lib/eve/draft";
import { draftMessage, restoreDraft } from "@/lib/eve/draft";
import type { EveMessageInput } from "@/lib/eve/message-input";
import { eveMessageTool } from "@/lib/eve/message-tool-selection";
import {
  finishCreation,
  prepareCreation,
  prepareResponseGroupCreation,
  readCreationRequest,
} from "@/lib/eve/pending-create";
import type {
  ReadonlyEveMessage,
  ReadonlyEveMessageInput,
  ReadonlyEveMessagePart,
} from "@/lib/eve/readonly-message-types";
import { resolveCreationRequest } from "@/lib/eve/resolve-creation-request";
import { responseModel } from "@/lib/eve/response-model";
import { useDefaultModel } from "@/providers/default-model-provider";
import { useTRPC } from "@/trpc/react";

import { useEveRuntime } from "./eve-logical-context";
import { useEveAttachments } from "./use-eve-attachments";

type Operation<Request = NonNullable<ReturnType<typeof readCreationRequest>>> =
  Request extends { message: EveMessageInput | ReadonlyEveMessageInput }
    ? Omit<Request, "message"> & { readonly message: ReadonlyEveMessageInput }
    : never;

interface EditContext {
  readonly events?: Parameters<typeof responseModel>[0];
  readonly modelSelection?: SelectedModelValue;
  readonly response?: ReadonlyEveMessage;
}

const responseModelSelection = (
  response: {
    readonly metadata?:
      | {
          readonly turnId?: string | undefined;
          readonly modelId?: string | undefined;
        }
      | undefined;
  },
  events: Parameters<typeof responseModel>[0]
): Extract<SelectedModelValue, string> | undefined => {
  const modelId = responseModel(
    events,
    response.metadata?.turnId ?? "",
    response.metadata?.modelId
  );
  if (isSelectedModelValue(modelId)) {
    return modelId;
  }
  return undefined;
};

const operationModelSelection = (
  operation: Operation
): SelectedModelValue | undefined => {
  if (!("modelIds" in operation)) {
    if (hasText(operation.modelId) && isSelectedModelValue(operation.modelId)) {
      return operation.modelId;
    }
    return undefined;
  }
  const selection: Record<string, number> = {};
  for (const modelId of operation.modelIds) {
    selection[modelId] = (selection[modelId] ?? 0) + 1;
  }
  if (isSelectedModelValue(selection)) {
    return selection;
  }
  return undefined;
};

export const useEveFork = (
  ownerId: string,
  conversationId: string,
  onComparisonStarted?: (
    message: ReadonlyEveMessageInput,
    selectedTool: UiToolName | undefined,
    clearComposer: boolean
  ) => void
) => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const restoreAttachments = useMutation(
    trpc.eve.restoreAttachments.mutationOptions()
  );
  const family = useQuery(
    trpc.eve.branches.queryOptions({ id: conversationId })
  );
  const openRuntime = useEveRuntime();
  const [isNavigating, startTransition] = useTransition();
  const selectedModel = useDefaultModel();
  const files = useEveAttachments();
  const { setAttachments } = files;
  const [editingMessageId, setEditingMessageId] = useState<string>();
  const [editRestoreFailed, setEditRestoreFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [rejected, setRejected] = useState(false);
  const lock = useRef(false);

  const store = useMemo(
    () =>
      createClientSnapshot<{
        draft: string;
        selectedTool: UiToolName | null;
        modelSelectionValue: SelectedModelValue | undefined;
        source: EveForkInput | undefined;
        pending: Operation | undefined;
        editingBoundary: string | undefined;
        restoreFailed: boolean;
        loaded: boolean;
        failure: string;
      }>(
        {
          draft: "",
          selectedTool: null,
          modelSelectionValue: undefined,
          source: undefined,
          pending: undefined,
          editingBoundary: undefined,
          restoreFailed: false,
          loaded: false,
          failure: "",
        },
        (current) => {
          const failed = {
            ...current,
            loaded: true,
            restoreFailed: true,
            failure:
              "The saved version request could not be restored. Keep this tab for recovery.",
          };
          try {
            const operation: Operation | undefined = readCreationRequest(
              sessionStorage,
              ownerId,
              { conversationId }
            );
            if (!operation) {
              return { ...current, loaded: true };
            }
            if (!operation.fork) {
              return failed;
            }
            const restored = restoreDraft(operation.message);
            setAttachments(restored.attachments);
            return {
              ...current,
              loaded: true,
              pending: operation,
              modelSelectionValue: operationModelSelection(operation),
              selectedTool: operation.selectedTool ?? null,
              source: operation.fork,
              editingBoundary: undefined,
              draft: restored.text,
            };
          } catch {
            return failed;
          }
        }
      ),
    [conversationId, ownerId, setAttachments]
  );
  const {
    draft,
    selectedTool,
    modelSelectionValue,
    source,
    pending,
    editingBoundary,
    restoreFailed,
    loaded,
    failure,
  } = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot
  );
  const {
    setDraft,
    setSelectedTool,
    setModelSelectionValue,
    setSource,
    setPending,
    setEditingBoundary,
    setFailure,
  } = useMemo(
    () => ({
      setDraft: (value: SetStateAction<string>): void => {
        store.update((current) => ({
          ...current,
          draft: typeof value === "function" ? value(current.draft) : value,
        }));
      },
      setSelectedTool: (value: SetStateAction<UiToolName | null>): void => {
        store.update((current) => ({
          ...current,
          selectedTool:
            typeof value === "function" ? value(current.selectedTool) : value,
        }));
      },
      setModelSelectionValue: (value: SelectedModelValue | undefined): void => {
        store.set("modelSelectionValue", value);
      },
      setSource: (value: EveForkInput | undefined): void => {
        store.set("source", value);
      },
      setPending: (value: Operation | undefined): void => {
        store.set("pending", value);
      },
      setEditingBoundary: (value: string | undefined): void => {
        store.set("editingBoundary", value);
      },
      setFailure: (value: string): void => {
        store.set("failure", value);
      },
    }),
    [store]
  );

  const execute = async (operation: Operation): Promise<void> => {
    const binding = await resolveCreationRequest(
      sessionStorage,
      ownerId,
      operation,
      {
        conversationId,
      }
    );
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: trpc.eve.branches.pathKey(),
        refetchType: "none",
      }),
      queryClient.invalidateQueries({ queryKey: trpc.eve.list.pathKey() }),
    ]);
    await openRuntime({ ...binding, operation, ownerId });
    startTransition(() => {
      // App Router Activity can keep this source route mounted while its successor
      // is active. Clear the fulfilled editor in the navigation transition so
      // recovery cannot revive an operation storage has already released.
      setPending(undefined);
      setEditingMessageId(undefined);
      setEditingBoundary(undefined);
      setSource(undefined);
      setDraft("");
      setSelectedTool(null);
      setModelSelectionValue(undefined);
      setEditRestoreFailed(false);
      setAttachments([]);
    });
  };
  const run = async (action: () => Promise<void>): Promise<void> => {
    if (lock.current) {
      return;
    }
    lock.current = true;
    setBusy(true);
    setFailure("");
    await withTaskCleanup(
      async () => {
        try {
          await action();
        } catch (error) {
          if (error instanceof CreationRejectedError) {
            setRejected(true);
            try {
              finishCreation(sessionStorage, ownerId, { conversationId });
              setPending(undefined);
              setRejected(false);
            } catch {
              setFailure(
                "The rejected version request could not be cleared. Keep this tab for recovery."
              );
              return;
            }
          }
          setFailure(
            error instanceof Error
              ? error.message
              : "Unable to create a version."
          );
        }
      },
      () => {
        lock.current = false;
        setBusy(false);
      }
    );
  };
  const begin = async (
    message: ReadonlyEveMessage,
    regeneration?: {
      readonly response: ReadonlyEveMessage;
      readonly events: Parameters<typeof responseModel>[0];
    },
    editContext?: EditContext
  ): Promise<void> => {
    await run(async () => {
      const boundary = message.id;
      if (
        pending ||
        hasText(editingMessageId) ||
        !family.data ||
        !hasText(boundary)
      ) {
        return;
      }
      const responseSelection = editContext?.response
        ? responseModelSelection(editContext.response, editContext.events ?? [])
        : undefined;
      const editingSelection =
        editContext?.modelSelection ?? responseSelection ?? selectedModel;
      const modelId = regeneration
        ? responseModelSelection(regeneration.response, regeneration.events)
        : undefined;
      const fork = {
        conversationId,
        beforeMessageId: boundary,
      };
      const text = message.parts
        .filter((part: ReadonlyEveMessagePart) => part.type === "text")
        .map((part) => part.text)
        .join("\n");
      const originalTool = eveMessageTool(message);
      setSelectedTool(originalTool);
      setModelSelectionValue(editingSelection);
      setDraft(text);
      setSource(fork);
      if (!regeneration) {
        setEditRestoreFailed(false);
        setEditingBoundary(boundary);
        setEditingMessageId(message.id);
        files.setAttachments([]);
      }
      // Re-upload the exact native bytes; never silently drop a file on an edit.
      let attachments: DraftAttachment[];
      try {
        attachments = message.parts.some(
          (part: ReadonlyEveMessagePart) => part.type === "file"
        )
          ? await restoreAttachments.mutateAsync({
              conversationId,
              messageId: message.id,
            })
          : [];
      } catch (error) {
        if (!regeneration) {
          setEditRestoreFailed(true);
        }
        throw error;
      }
      files.setAttachments(attachments);
      if (regeneration) {
        if (!hasText(modelId) || typeof modelId !== "string") {
          throw new Error(
            "The response model is unavailable. Reload before regenerating."
          );
        }
        const operation = prepareCreation(
          sessionStorage,
          ownerId,
          draftMessage(text, attachments),
          modelId,
          { conversationId, fork, forkKind: "regenerate" },
          originalTool ?? undefined
        );
        setPending(operation);
        await execute(operation);
      } else {
        setEditingMessageId(message.id);
      }
    });
  };
  return {
    begin,
    busy,
    cancelEdit: () => {
      if (busy || pending || isNavigating) {
        return;
      }
      setEditingMessageId(undefined);
      setEditingBoundary(undefined);
      setEditRestoreFailed(false);
      setSource(undefined);
      setFailure("");
    },
    compare: async (
      message: ReadonlyEveMessageInput,
      modelIds: readonly string[],
      requestedTool?: UiToolName,
      clearComposer = true
    ) => {
      await run(async () => {
        if (!loaded || restoreFailed || pending || hasText(editingMessageId)) {
          return;
        }
        const operation = prepareResponseGroupCreation(
          sessionStorage,
          ownerId,
          message,
          modelIds,
          {
            conversationId,
            fork: {
              conversationId,
            },
          },
          requestedTool
        );
        onComparisonStarted?.(
          operation.message,
          operation.selectedTool,
          clearComposer
        );
        setPending(operation);
        await execute(operation);
      });
    },
    draft,
    editingBoundary,
    editingMessageId,
    error: failure,
    family,
    files,
    locked:
      !loaded ||
      restoreFailed ||
      editRestoreFailed ||
      busy ||
      isNavigating ||
      Boolean(pending),
    modelSelection: {
      onChange: (value: SelectedModelValue) => {
        if (busy || pending || isNavigating) {
          return;
        }
        setModelSelectionValue(value);
      },
      value: modelSelectionValue ?? selectedModel,
    },
    pending,
    rejected,
    retry: async () => {
      await run(async () => {
        if (pending && rejected) {
          try {
            finishCreation(sessionStorage, ownerId, { conversationId });
            setPending(undefined);
            setRejected(false);
          } catch {
            setFailure(
              "The rejected version request could not be cleared. Keep this tab for recovery."
            );
          }
        } else if (pending) {
          await execute(pending);
        }
      });
    },
    selectedTool,
    setDraft,
    setSelectedTool,
    submit: async () => {
      await run(async () => {
        if (
          !loaded ||
          restoreFailed ||
          editRestoreFailed ||
          isNavigating ||
          pending ||
          !source
        ) {
          return;
        }
        const modelIds = expandSelectedModelValue(
          modelSelectionValue ?? selectedModel
        );
        const message = draftMessage(draft, files.attachments);
        const operation =
          modelIds.length > 1
            ? prepareResponseGroupCreation(
                sessionStorage,
                ownerId,
                message,
                modelIds,
                { conversationId, fork: source, forkKind: "edit" },
                selectedTool ?? undefined
              )
            : prepareCreation(
                sessionStorage,
                ownerId,
                message,
                modelIds[0],
                { conversationId, fork: source, forkKind: "edit" },
                selectedTool ?? undefined
              );
        setPending(operation);
        await execute(operation);
      });
    },
  };
};
